"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mic, MicOff, Video, VideoOff, MessageCircle, X, Send } from "lucide-react";
import {
  LiveKitAvatar,
  type LiveTranscriptEntry,
} from "@/components/session/livekit-avatar";
import { useAttention } from "@/hooks/use-attention";
import { useAttentionPolicy } from "@/hooks/use-attention-policy";
import { AttentionDebug } from "@/components/session/attention-debug";
import { getInterventionMessage } from "@/lib/attention";
import { MathVisual } from "@/components/session/math-visual";
import { MessageContent } from "@/components/session/message-content";
import type { AdaptiveState, ContentConfidenceState, KidSession } from "@/types";
import {
  createInitialAdaptiveState,
  handleDistraction,
} from "@/lib/adaptive";
import "@/styles/vertex.css";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "chat" | "quiz" | "hint" | "reminder";
  jsxGraph?: unknown;
}

interface LessonPlan {
  title: string;
  overview: string;
  sections: { heading: string; content: string; examples: { problem: string; steps: string[]; answer: string }[] }[];
  practiceProblems: { id: number; question: string; hint: string; solution: string; answer: string }[];
}

function KidSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kidSessionId = searchParams.get("kidSessionId");
  const parentId = searchParams.get("parentId");
  const documentId = searchParams.get("documentId");

  const [kidSession] = useState<KidSession | null>(() => readStoredKidSession());
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [tutoringSessionId, setTutoringSessionId] = useState<string | null>(null);
  const [documentContext, setDocumentContext] = useState<string | null>(null);
  const [liveTutorEnabled, setLiveTutorEnabled] = useState(false);
  const [adaptiveState, setAdaptiveState] = useState<AdaptiveState>(createInitialAdaptiveState());
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [agentPromptRequest, setAgentPromptRequest] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const greetedSessionIdsRef = useRef<Set<string>>(new Set());
  const transcriptHistoryRef = useRef<LiveTranscriptEntry[]>([]);

  // Chat panel state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Lesson plan state
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const lastVisualRequestRef = useRef<string | null>(null);

  const childName = kidSession?.child_name?.trim() || "there";

  const [contentConfidence, setContentConfidence] = useState<ContentConfidenceState | null>(null);
  const tutorName = process.env.NEXT_PUBLIC_TUTOR_AVATAR_NAME || "Tina";

  // Use refs so closures always have the latest value without being deps
  const childNameRef = useRef(childName);
  const tutorNameRef = useRef(tutorName);
  useEffect(() => { childNameRef.current = childName; }, [childName]);
  useEffect(() => { tutorNameRef.current = tutorName; }, [tutorName]);

  const handleIntervention = useCallback(
    (type: string) => {
      const message = getInterventionMessage(type, childName);
      setAgentPromptRequest({
        id: Date.now(),
        text: message,
      });

      if (type === "simplify_and_checkin") {
        setAdaptiveState((prev) => handleDistraction(prev));
      }
    },
    [childName]
  );

  const attention = useAttention(tutoringSessionId || "none", handleIntervention, cameraEnabled);

  const handlePolicyIntervention = useCallback((text: string) => {
    setAgentPromptRequest({ id: Date.now(), text });
  }, []);

  const handlePolicyEndSession = useCallback(() => {
    // Auto-end session when policy decides both focus + confidence are critically low
    void endSessionRef.current?.();
  }, []);

  const { policyLog } = useAttentionPolicy(
    attention.score,
    contentConfidence,
    {
      childName,
      sessionId: tutoringSessionId || "",
      kidSessionId: kidSessionId || "",
    },
    handlePolicyIntervention,
    handlePolicyEndSession,
  );

  const endSessionRef = useRef<(() => Promise<void>) | null>(null);

  // Generate lesson plan from document - stable ref ensures no re-render chain
  const generateLessonPlan = useCallback(async (docText: string) => {
    setLessonLoading(true);
    try {
      const res = await fetch("/api/lesson/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText: docText,
          childName: childNameRef.current,
          childAge: 10,
        }),
      });
      const data = await res.json();
      if (data.lesson) {
        setLessonPlan(data.lesson);
        setLessonLoading(false);
        return data.lesson as LessonPlan;
      }
    } catch {
      // lesson generation failed, avatar will still work without it
    }
    setLessonLoading(false);
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // stable — reads childNameRef at call time

  const queueInitialGreeting = useCallback((sessionId: string, name: string, lesson: LessonPlan | null) => {
    if (greetedSessionIdsRef.current.has(sessionId)) return;

    greetedSessionIdsRef.current.add(sessionId);
    const tName = tutorNameRef.current;

    if (lesson) {
      const lessonScript = buildLessonScript(lesson);
      setAgentPromptRequest({
        id: Date.now(),
        text: `You have a prepared lesson plan for ${name} based on their homework. Here is the lesson plan:\n\n${lessonScript}\n\nStart by greeting ${name} warmly, introduce yourself as ${tName}, and then ask: "I've prepared a lesson based on your homework about ${lesson.title}. Would you like me to walk you through it step by step, or do you have a specific question you'd like help with first?" Then follow their choice. If they want the lesson, teach it section by section in a conversational way, using the examples from the plan. If they have a question, answer it using the lesson content as context.`,
      });
    } else {
      setAgentPromptRequest({
        id: Date.now(),
        text: `Start the session now. Greet ${name} warmly, introduce yourself as ${tName}, and ask what math problem they want to work on first.`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // stable — reads tutorNameRef at call time

  const initSession = useCallback(
    async (session: KidSession) => {
      try {
        const cacheKey = getLiveSessionCacheKey(session.id, documentId);
        const cachedSession = readCachedLiveSession(cacheKey);

        if (cachedSession) {
          transcriptHistoryRef.current = [];
          setMessages([]);
          setTutoringSessionId(cachedSession.sessionId);
          setDocumentContext(cachedSession.documentContext);
          setLiveTutorEnabled(Boolean(cachedSession.liveTutorEnabled));
          setMicEnabled(false);

          // Generate lesson if document present
          let lesson: LessonPlan | null = null;
          if (documentId && cachedSession.documentContext) {
            lesson = await generateLessonPlan(cachedSession.documentContext);
          }
          queueInitialGreeting(cachedSession.sessionId, session.child_name?.trim() || "there", lesson);
          return;
        }

        const res = await fetch("/api/student/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kidSessionId: session.id, parentId, documentId }),
        });
        const data = await res.json();

        if (data.sessionId) {
          transcriptHistoryRef.current = [];
          setMessages([]);
          setTutoringSessionId(data.sessionId);
        }
        if (data.documentContext) setDocumentContext(data.documentContext);
        setLiveTutorEnabled(Boolean(data.liveTutorEnabled));
        setMicEnabled(false);

        // Use pre-generated lesson plan if available, otherwise generate from document text
        let lesson: LessonPlan | null = null;
        if (data.lessonPlan) {
          setLessonPlan(data.lessonPlan);
          lesson = data.lessonPlan as LessonPlan;
        } else if (documentId && data.documentContext) {
          lesson = await generateLessonPlan(data.documentContext);
        }

        if (data.sessionId) {
          queueInitialGreeting(data.sessionId, session.child_name?.trim() || "there", lesson);
        }

        if (data.sessionId) {
          writeCachedLiveSession(cacheKey, {
            sessionId: data.sessionId,
            documentContext: data.documentContext || null,
            liveTutorEnabled: Boolean(data.liveTutorEnabled),
            createdAt: Date.now(),
          });
        }
      } catch {
        // ignore
      }
    },
    [documentId, parentId, queueInitialGreeting, generateLessonPlan]
  );

  useEffect(() => {
    if (!kidSessionId || !kidSession) {
      router.push("/dashboard/kid");
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initSession(kidSession);
  }, [initSession, kidSession, kidSessionId, router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function parseJsxGraph(content: string) {
    const graphs: unknown[] = [];
    const clean = content.replace(/\[JSXGRAPH\]([\s\S]*?)\[\/JSXGRAPH\]/g, (_, json) => {
      try {
        graphs.push(JSON.parse(json));
      } catch {
        // skip invalid graph payload
      }
      return "";
    });

    return { cleanContent: clean.trim(), graphs };
  }

  const appendTranscriptMessage = useCallback((entry: LiveTranscriptEntry) => {
    transcriptHistoryRef.current = [...transcriptHistoryRef.current.slice(-19), entry];

    if (entry.role !== "assistant") {
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `${entry.role}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
        role: entry.role,
        content: entry.text,
        type: "chat",
      },
    ]);
  }, []);

  const requestVisualAid = useCallback(async (text: string) => {
    if (!tutoringSessionId || loading) return;

    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: tutoringSessionId,
          kidSessionId,
          parentId,
          message: text,
          messageType: "chat",
          childName: kidSession?.child_name || "student",
          documentContext,
          adaptiveState,
          recentMessages: transcriptHistoryRef.current.slice(-10).map((entry) => ({
            role: entry.role,
            content: entry.text,
          })),
          persistMessages: false,
        }),
      });

      const data = await res.json();
      if (data.content) {
        const { cleanContent, graphs } = parseJsxGraph(data.content);

        if (graphs.length > 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: `visual-${Date.now()}`,
              role: "assistant",
              content: cleanContent || "Visual",
              type: "chat",
              jsxGraph: graphs,
            },
          ]);
        }
      }
    } catch {
      // ignore visual sidecar failures
    }
    setLoading(false);
  }, [
    adaptiveState,
    documentContext,
    kidSession,
    kidSessionId,
    loading,
    parentId,
    tutoringSessionId,
  ]);

  const maybeRequestVisualAid = useCallback(
    async (text: string) => {
      if (!shouldGenerateVisual(text)) return;

      const normalized = text.trim().toLowerCase();
      if (lastVisualRequestRef.current === normalized) return;

      lastVisualRequestRef.current = normalized;
      await requestVisualAid(text);
    },
    [requestVisualAid]
  );

  const handleTranscript = useCallback(
    (entry: LiveTranscriptEntry) => {
      appendTranscriptMessage(entry);

      if (entry.role === "user") {
        void maybeRequestVisualAid(entry.text);
      }
    },
    [appendTranscriptMessage, maybeRequestVisualAid]
  );

  // Send text chat message
  async function sendChatMessage() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatLoading(true);

    const newUserMsg: DisplayMessage = {
      id: `user-typed-${Date.now()}`,
      role: "user",
      content: userMsg,
      type: "chat",
    };
    setMessages((prev) => [...prev, newUserMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: tutoringSessionId,
          message: userMsg,
          messageType: "chat",
          childName: kidSession?.child_name || "student",
          childAge: 10,
          documentContext,
          adaptiveState,
          recentMessages: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (data.content) {
        const { cleanContent, graphs } = parseJsxGraph(data.content);
        setMessages((prev) => [...prev, {
          id: `assistant-typed-${Date.now()}`,
          role: "assistant",
          content: cleanContent,
          type: "chat",
          jsxGraph: graphs.length > 0 ? graphs : undefined,
        }]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Oops, something went wrong. Try again!",
        type: "chat",
      }]);
    }
    setChatLoading(false);
    chatInputRef.current?.focus();
  }

  async function endSession() {
    if (kidSessionId) {
      clearCachedLiveSession(getLiveSessionCacheKey(kidSessionId, documentId));
    }

    if (tutoringSessionId) {
      try {
        await fetch("/api/student/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: tutoringSessionId, focusScore: attention.getSessionAverageScore() }),
        });
      } catch {
        // ignore
      }
    }

    router.push(
      "/session/kid/recap?" +
        new URLSearchParams({
          sessionId: tutoringSessionId || "",
          kidSessionId: kidSessionId || "",
          score: String(attention.score),
          messages: String(messages.length),
        }).toString()
    );
  }

  // Wire up the ref so the policy engine can call endSession
  endSessionRef.current = endSession;

  const focusColor =
    attention.focusLevel === "high"
      ? "#5c7c6a"
      : attention.focusLevel === "medium"
      ? "#c89020"
      : "#c8416a";

  type MathVisualConfig = { type: string; [key: string]: unknown };

  const unreadCount = messages.filter((m) => m.role === "assistant").length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fef7ee",
        fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
        color: "#1e1a12",
      }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          background: "rgba(255, 250, 244, 0.84)",
          borderBottom: "1px solid rgba(89, 66, 46, 0.08)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={endSession}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(120, 91, 63, 0.16)",
              background: "#fff7f0",
              color: "#7a6654",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={14} /> End Session
          </button>

          {lessonPlan && (
            <span style={{ fontSize: 12, color: "#8a7f6e", fontWeight: 400 }}>
              {lessonPlan.title}
            </span>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              borderRadius: 999,
              background: "rgba(255, 247, 240, 0.92)",
              border: "1px solid rgba(120, 91, 63, 0.12)",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: focusColor,
                boxShadow: `0 0 0 4px ${focusColor}22`,
                flexShrink: 0,
              }}
            />
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#8a7f6e",
                }}
              >
                Focus
              </span>
              <span
                style={{
                  fontSize: 22,
                  lineHeight: 1,
                  fontWeight: 800,
                  color: "#2a2018",
                }}
              >
                {attention.score}%
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {lessonLoading && (
            <span style={{ fontSize: 11, color: "#8a7f6e" }}>Preparing lesson...</span>
          )}
          <MediaToggleButton
            active={micEnabled}
            disabled={!liveTutorEnabled}
            activeLabel="Mic On"
            inactiveLabel="Mic Off"
            activeIcon={<Mic size={14} />}
            inactiveIcon={<MicOff size={14} />}
            onClick={() => setMicEnabled((prev) => !prev)}
          />
          <MediaToggleButton
            active={cameraEnabled}
            disabled={!liveTutorEnabled}
            activeLabel="Camera On"
            inactiveLabel="Camera Off"
            activeIcon={<Video size={14} />}
            inactiveIcon={<VideoOff size={14} />}
            onClick={() => setCameraEnabled((prev) => !prev)}
          />
        </div>
      </header>

      <main style={{ padding: "22px 20px 28px", height: "calc(100vh - 73px)", display: "flex", gap: 0 }}>
        {/* Avatar panel — takes full width when chat closed, left half when open */}
        <section style={{
          flex: chatOpen ? "0 0 50%" : "1 1 100%",
          transition: "flex 0.3s ease",
          minWidth: 0,
        }}>
          <div
            style={{
              height: "100%",
              padding: 16,
              borderRadius: 28,
              background: "rgba(255,255,255,0.74)",
              border: "1px solid rgba(120, 91, 63, 0.08)",
              boxShadow: "0 18px 40px rgba(94, 70, 48, 0.08)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ flex: 1, minHeight: 0 }}>
              {liveTutorEnabled && tutoringSessionId ? (
                <LiveKitAvatar
                  className="h-full w-full"
                  sessionId={tutoringSessionId}
                  kidSessionId={kidSessionId}
                  parentId={parentId}
                  documentId={documentId}
                  micEnabled={micEnabled}
                  cameraEnabled={cameraEnabled}
                  childName={childName}
                  onTranscript={handleTranscript}
                  agentPromptRequest={agentPromptRequest}
                />
              ) : (
                <div
                  style={{
                    height: "100%",
                    minHeight: 400,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    padding: 24,
                    borderRadius: 24,
                    background: "#1d2431",
                    color: "#fff4e6",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(255,255,255,0.08)",
                      fontSize: 32,
                      fontWeight: 700,
                    }}
                  >
                    T
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{tutorName} is offline</div>
                  <div style={{ maxWidth: 380, fontSize: 13, lineHeight: 1.6, color: "rgba(255,244,230,0.76)" }}>
                    Add the Simli and LiveKit environment variables to bring {tutorName} online as a live call tutor.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Chat toggle button — visible when chat is closed */}
        {!chatOpen && (
          <button
            onClick={() => { setChatOpen(true); setTimeout(() => chatInputRef.current?.focus(), 200); }}
            style={{
              position: "fixed",
              bottom: 28,
              right: 28,
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#c8416a",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(200,65,106,0.35)",
              zIndex: 30,
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = "scale(1.1)"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = "scale(1)"; }}
          >
            <MessageCircle size={24} />
            {messages.length > 0 && (
              <span style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#f5a623",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {Math.min(unreadCount, 99)}
              </span>
            )}
          </button>
        )}

        {/* Chat panel — right half when open */}
        {chatOpen && (
          <aside style={{
            flex: "0 0 50%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            marginLeft: 20,
            borderRadius: 28,
            overflow: "hidden",
            background: "rgba(255,255,255,0.78)",
            border: "1px solid rgba(120, 91, 63, 0.08)",
            boxShadow: "0 18px 40px rgba(94, 70, 48, 0.08)",
          }}>
            {/* Chat header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "18px 18px 14px",
                borderBottom: "1px solid rgba(120, 91, 63, 0.08)",
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Chat</div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#8a7f6e" }}>
                  {lessonPlan
                    ? "Lesson transcript and typed messages. Ask questions anytime!"
                    : `${tutorName}'s live speech shows up here, and graphs appear when you ask to see one.`}
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(120, 91, 63, 0.06)",
                  border: "none",
                  cursor: "pointer",
                  color: "#8a7f6e",
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: "flex",
                    justifyContent: message.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "88%",
                      padding: "12px 14px",
                      borderRadius: 18,
                      fontSize: 14,
                      lineHeight: 1.6,
                      boxShadow: "0 12px 24px rgba(52, 39, 29, 0.06)",
                      ...(message.role === "user"
                        ? {
                            background: "#c8416a",
                            color: "#fff",
                            borderBottomRightRadius: 6,
                          }
                        : message.type === "reminder"
                        ? {
                            background: "rgba(166,124,74,0.08)",
                            border: "1px solid rgba(166,124,74,0.18)",
                            color: "#574b40",
                            borderBottomLeftRadius: 6,
                          }
                        : {
                            background: "#fffdf9",
                            border: "1px solid rgba(120, 91, 63, 0.08)",
                            color: "#20170f",
                            borderBottomLeftRadius: 6,
                          }),
                    }}
                  >
                    <MessageContent content={message.content} />
                    {message.jsxGraph
                      ? (message.jsxGraph as MathVisualConfig[]).map((config, index) => (
                          <MathVisual key={index} config={config} />
                        ))
                      : null}
                  </div>
                </div>
              ))}

              {(loading || chatLoading) && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div
                    style={{
                      background: "#fffdf9",
                      border: "1px solid rgba(120, 91, 63, 0.08)",
                      borderRadius: 18,
                      padding: "12px 14px",
                      display: "flex",
                      gap: 4,
                    }}
                  >
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#c8416a",
                          animation: `vtxBounce 0.6s ease infinite ${index * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {!messages.length && !loading && (
                <div
                  style={{
                    borderRadius: 18,
                    border: "1px dashed rgba(120, 91, 63, 0.16)",
                    padding: 18,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "#8a7f6e",
                    background: "rgba(255,255,255,0.56)",
                  }}
                >
                  {lessonPlan
                    ? `${tutorName} is teaching you about "${lessonPlan.title}". The conversation will appear here. You can also type questions below!`
                    : `Start talking to ${tutorName}. This panel will mirror the live conversation and show visuals when you ask to graph or draw something.`}
                </div>
              )}
            </div>

            {/* Text input */}
            <div style={{
              padding: "12px 18px",
              borderTop: "1px solid rgba(120, 91, 63, 0.08)",
              flexShrink: 0,
            }}>
              <form onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }} style={{
                display: "flex", gap: 8,
              }}>
                <input
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a question..."
                  disabled={chatLoading}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    border: "1.5px solid rgba(120, 91, 63, 0.12)",
                    borderRadius: 999,
                    fontSize: 14,
                    outline: "none",
                    background: "#fef7ee",
                    fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                  }}
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "#c8416a",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: chatLoading || !chatInput.trim() ? 0.4 : 1,
                    flexShrink: 0,
                  }}
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </aside>
        )}
      </main>

      <style>{`
        @keyframes vtxBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>

      {/* Attention Debug Overlay (Ctrl+Shift+D) */}
      <AttentionDebug
        webcamStream={attention.webcam.stream}
        landmarks={attention.webcam.lastLandmarks}
        signals={attention.signals}
        smoothedFocus={attention.score}
        contentConfidence={contentConfidence}
        calibration={attention.calibration}
        policyLog={policyLog}
      />
    </div>
  );
}

function MediaToggleButton({
  active,
  disabled,
  activeLabel,
  inactiveLabel,
  activeIcon,
  inactiveIcon,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 14px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(92, 124, 106, 0.28)"
          : "1px solid rgba(120, 91, 63, 0.14)",
        background: active ? "rgba(92, 124, 106, 0.12)" : "#fff7f0",
        color: active ? "#4d775d" : "#7a6654",
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {active ? activeIcon : inactiveIcon}
      {active ? activeLabel : inactiveLabel}
    </button>
  );
}

export default function KidSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="vtx-auth-page">
          <p style={{ color: "#8a7f6e" }}>Loading session...</p>
        </div>
      }
    >
      <KidSessionContent />
    </Suspense>
  );
}

function readStoredKidSession(): KidSession | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem("vertex_kid_session");
    return stored ? (JSON.parse(stored) as KidSession) : null;
  } catch {
    return null;
  }
}

interface CachedLiveSession {
  sessionId: string;
  documentContext: string | null;
  liveTutorEnabled: boolean;
  createdAt: number;
}

function getLiveSessionCacheKey(kidSessionId: string, documentId: string | null) {
  return `vertex_live_session:${kidSessionId}:${documentId || "none"}`;
}

function readCachedLiveSession(cacheKey: string): CachedLiveSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedLiveSession;
    const expired = Date.now() - parsed.createdAt > 1000 * 60 * 90;
    if (expired) {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCachedLiveSession(cacheKey: string, session: CachedLiveSession) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(session));
  } catch {
    // ignore sessionStorage failures
  }
}

function clearCachedLiveSession(cacheKey: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(cacheKey);
  } catch {
    // ignore sessionStorage failures
  }
}

function shouldGenerateVisual(text: string) {
  const normalized = text.toLowerCase();

  return (
    /(graph|plot|draw|show|visualize|sketch)/.test(normalized) &&
    /(function|equation|line|curve|parabola|x|y|coordinate)/.test(normalized)
  );
}

function buildLessonScript(lesson: LessonPlan): string {
  let script = `LESSON: ${lesson.title}\n`;
  script += `OVERVIEW: ${lesson.overview}\n\n`;

  lesson.sections.forEach((section, i) => {
    script += `--- SECTION ${i + 1}: ${section.heading} ---\n`;
    script += `${section.content}\n\n`;
    section.examples.forEach((ex, j) => {
      script += `EXAMPLE ${j + 1}: ${ex.problem}\n`;
      ex.steps.forEach((step) => {
        script += `  ${step}\n`;
      });
      script += `  ANSWER: ${ex.answer}\n\n`;
    });
  });

  if (lesson.practiceProblems.length > 0) {
    script += `--- PRACTICE PROBLEMS ---\n`;
    lesson.practiceProblems.forEach((p) => {
      script += `Q${p.id}: ${p.question} (Answer: ${p.answer})\n`;
    });
  }

  return script;
}
