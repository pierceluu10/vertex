"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Send, ArrowLeft, Sparkles, Lightbulb, Mic, MicOff, Video, VideoOff, Gamepad2 } from "lucide-react";
import { FlappyQuiz } from "@/components/vertex/flappy-quiz";
import { createClient } from "@/lib/supabase/client";
import { HeyGenAvatar } from "@/components/session/heygen-avatar";
import { useAttention } from "@/hooks/use-attention";
import { getInterventionMessage } from "@/lib/attention";
import { MathVisual } from "@/components/session/math-visual";
import type { Message, Child, AdaptiveState } from "@/types";
import { createInitialAdaptiveState, handleCorrectAnswer, handleIncorrectAnswer, handleDistraction } from "@/lib/adaptive";
import "@/styles/vertex.css";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "chat" | "quiz" | "hint" | "reminder";
  jsxGraph?: unknown;
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const supabase = createClient();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState(8);
  const [parentName, setParentName] = useState("");
  const [documentContext, setDocumentContext] = useState<string | null>(null);
  const [adaptiveState, setAdaptiveState] = useState<AdaptiveState>(
    createInitialAdaptiveState()
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakText, setSpeakText] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [webcamOn, setWebcamOn] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [showGame, setShowGame] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selfVideoRef = useRef<HTMLVideoElement>(null);

  const handleIntervention = useCallback(
    (type: string) => {
      if (!childName) return;
      const message = getInterventionMessage(type, childName);
      setMessages((prev) => [
        ...prev,
        {
          id: `intervention-${Date.now()}`,
          role: "assistant",
          content: message,
          type: "reminder",
        },
      ]);

      if (type === "simplify_and_checkin") {
        setAdaptiveState((prev) => handleDistraction(prev));
      }

      setSpeakText(message);
    },
    [childName]
  );

  const attention = useAttention(sessionId, handleIntervention, webcamOn);

  // Attach webcam stream to the self-view video element
  useEffect(() => {
    if (selfVideoRef.current && attention.webcam?.stream) {
      selfVideoRef.current.srcObject = attention.webcam.stream;
      selfVideoRef.current.play().catch(() => {});
    }
    if (selfVideoRef.current && !attention.webcam?.stream) {
      selfVideoRef.current.srcObject = null;
    }
  }, [attention.webcam?.stream]);

  useEffect(() => {
    async function loadSession() {
      const { data: session } = await supabase
        .from("tutoring_sessions")
        .select("*, children(*)")
        .eq("id", sessionId)
        .single();

      if (!session) {
        router.push("/dashboard");
        return;
      }

      const child = session.children as unknown as Child;
      setChildName(child.name);
      setChildAge(child.age);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: parent } = await supabase
          .from("parents")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (parent) setParentName(parent.full_name);
      }

      if (session.document_id) {
        const { data: doc } = await supabase
          .from("uploaded_documents")
          .select("extracted_text")
          .eq("id", session.document_id)
          .single();
        if (doc?.extracted_text) {
          setDocumentContext(doc.extracted_text.slice(0, 4000));
        }
      }

      const { data: existingMessages } = await supabase
        .from("messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (existingMessages && existingMessages.length > 0) {
        setMessages(
          existingMessages
            .filter((m: Message) => m.role !== "system")
            .map((m: Message) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              type: m.message_type as "chat" | "quiz" | "hint" | "reminder",
            }))
        );
      } else {
        const greeting = `Hi ${child.name}! I\u2019m here to help you with your math. What would you like to work on today?`;
        setMessages([{
          id: "greeting",
          role: "assistant",
          content: greeting,
          type: "chat",
        }]);
        setSpeakText(greeting);
      }
    }

    loadSession();
  }, [sessionId, supabase, router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function parseJsxGraph(content: string): { cleanContent: string; graphs: unknown[] } {
    const graphs: unknown[] = [];
    const cleanContent = content.replace(
      /\[JSXGRAPH\](.*?)\[\/JSXGRAPH\]/g,
      (_, json) => {
        try { graphs.push(JSON.parse(json)); } catch { /* skip */ }
        return "";
      }
    );
    return { cleanContent: cleanContent.trim(), graphs };
  }

  async function sendMessage(text: string, type: "chat" | "quiz" | "hint" = "chat") {
    if (!text.trim() || loading) return;
    setLoading(true);
    setInput("");

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      type,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: text,
          messageType: type,
          childName,
          childAge,
          documentContext,
          adaptiveState,
          recentMessages: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (data.content) {
        const { cleanContent, graphs } = parseJsxGraph(data.content);

        const assistantMsg: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: cleanContent,
          type: data.messageType || "chat",
          jsxGraph: graphs.length > 0 ? graphs : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setSpeakText(cleanContent);

        if (data.isCorrect !== undefined) {
          setAdaptiveState((prev) =>
            data.isCorrect ? handleCorrectAnswer(prev) : handleIncorrectAnswer(prev)
          );
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Oops, something went wrong. Try again!",
          type: "chat",
        },
      ]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  function handleUserVoiceMessage(transcript: string) {
    if (transcript.trim()) {
      setLiveTranscript("");
      sendMessage(transcript);
    }
  }

  function handleUserSpeaking(text: string) {
    setLiveTranscript(text);
  }

  async function endSession() {
    await supabase
      .from("tutoring_sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        focus_score_avg: attention.score,
      })
      .eq("id", sessionId);

    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch { /* non-blocking */ }

    router.push("/dashboard");
  }

  const focusColor =
    attention.focusLevel === "high" ? "#5a9e76"
    : attention.focusLevel === "medium" ? "#c89020"
    : "#c8416a";

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#f4efe5", fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
      color: "#1e1a12",
    }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid rgba(55,45,25,0.10)", background: "rgba(248,243,232,0.95)",
        padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={endSession} style={{
            display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
            color: "#8a7f6e", fontSize: 12, cursor: "pointer", letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
          }}>
            <ArrowLeft size={14} /> End
          </button>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{childName}&apos;s Study Session</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%", background: focusColor,
                boxShadow: `0 0 6px ${focusColor}40`,
              }} />
              <span style={{ fontSize: 11, color: "#8a7f6e" }}>Focus: {attention.score}%</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setWebcamOn(!webcamOn)} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
            border: "1px solid rgba(55,45,25,0.10)", borderRadius: 3, background: "transparent",
            color: webcamOn ? "#5a9e76" : "#8a7f6e", fontSize: 10, cursor: "pointer",
            letterSpacing: "0.1em", textTransform: "uppercase" as const,
          }}>
            {webcamOn ? <Video size={12} /> : <VideoOff size={12} />}
            {webcamOn ? "Cam On" : "Cam Off"}
          </button>
          <button onClick={() => setMicEnabled(!micEnabled)} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
            border: "1px solid rgba(55,45,25,0.10)", borderRadius: 3, background: "transparent",
            color: micEnabled ? "#5a9e76" : "#8a7f6e", fontSize: 10, cursor: "pointer",
            letterSpacing: "0.1em", textTransform: "uppercase" as const,
          }}>
            {micEnabled ? <Mic size={12} /> : <MicOff size={12} />}
            {micEnabled ? "Mic On" : "Mic Off"}
          </button>
          <button onClick={() => sendMessage("Give me a hint for what we're working on", "hint")} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
            border: "1px solid rgba(200,65,106,0.2)", borderRadius: 3, background: "transparent",
            color: "#c8416a", fontSize: 10, cursor: "pointer",
            letterSpacing: "0.1em", textTransform: "uppercase" as const,
          }}>
            <Lightbulb size={12} /> Hint
          </button>
          <button onClick={() => sendMessage("Quiz me on what we've been studying", "quiz")} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
            border: "1px solid rgba(200,65,106,0.2)", borderRadius: 3, background: "transparent",
            color: "#c8416a", fontSize: 10, cursor: "pointer",
            letterSpacing: "0.1em", textTransform: "uppercase" as const,
          }}>
            <Sparkles size={12} /> Quiz Me
          </button>
          <button onClick={() => setShowGame(true)} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
            border: "1px solid rgba(200,65,106,0.2)", borderRadius: 3, background: "rgba(200,65,106,0.06)",
            color: "#c8416a", fontSize: 10, cursor: "pointer",
            letterSpacing: "0.1em", textTransform: "uppercase" as const,
          }}>
            <Gamepad2 size={12} /> Play
          </button>
        </div>
      </header>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Chat area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    marginBottom: 12,
                  }}
                >
                  <div style={{
                    maxWidth: "80%", padding: "12px 16px", borderRadius: 6,
                    fontSize: 14, lineHeight: 1.65,
                    ...(msg.role === "user"
                      ? { background: "#c8416a", color: "#fff", borderBottomRightRadius: 2 }
                      : msg.type === "reminder"
                      ? { background: "rgba(200,153,32,0.08)", border: "1px solid rgba(200,153,32,0.2)", color: "#1e1a12", borderBottomLeftRadius: 2 }
                      : msg.type === "quiz"
                      ? { background: "rgba(200,65,106,0.06)", border: "1px solid rgba(200,65,106,0.15)", color: "#1e1a12", borderBottomLeftRadius: 2 }
                      : { background: "#f8f3e8", border: "1px solid rgba(55,45,25,0.08)", color: "#1e1a12", borderBottomLeftRadius: 2 }),
                  }}>
                    {msg.type === "quiz" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                        <Sparkles size={12} style={{ color: "#c8416a" }} />
                        <span style={{ fontSize: 10, fontWeight: 500, color: "#c8416a", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Quiz</span>
                      </div>
                    )}
                    {msg.type === "hint" && msg.role === "assistant" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                        <Lightbulb size={12} style={{ color: "#c89020" }} />
                        <span style={{ fontSize: 10, fontWeight: 500, color: "#c89020", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Hint</span>
                      </div>
                    )}
                    <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                    {msg.jsxGraph ? (msg.jsxGraph as MathVisualConfig[]).map((config, i) => (
                      <MathVisual key={i} config={config} />
                    )) : null}
                  </div>
                </div>
              ))}

              {liveTranscript && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <div style={{
                    maxWidth: "80%", padding: "10px 14px", borderRadius: 6,
                    fontSize: 14, lineHeight: 1.65, borderBottomRightRadius: 2,
                    background: "rgba(200,65,106,0.3)", color: "#fff",
                    fontStyle: "italic", opacity: 0.8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Mic size={12} />
                      <span>{liveTranscript}</span>
                    </div>
                  </div>
                </div>
              )}

              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
                  <div style={{
                    background: "#f8f3e8", border: "1px solid rgba(55,45,25,0.08)",
                    borderRadius: 6, padding: "12px 16px", display: "flex", gap: 4,
                  }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: "50%", background: "#c8416a",
                        animation: `vtxBounce 0.6s ease infinite ${i * 0.15}s`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div style={{
            borderTop: "1px solid rgba(55,45,25,0.10)", background: "rgba(248,243,232,0.95)",
            padding: "12px 24px", flexShrink: 0,
          }}>
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              style={{ maxWidth: 640, margin: "0 auto", display: "flex", gap: 8 }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question or type your answer..."
                disabled={loading}
                autoFocus
                style={{
                  flex: 1, padding: "10px 14px", border: "1.5px solid rgba(55,45,25,0.10)",
                  borderRadius: 3, background: "rgba(244,239,229,0.6)", color: "#1a1610",
                  fontFamily: "'Calibri', 'Trebuchet MS', sans-serif", fontSize: 14,
                  fontWeight: 300, outline: "none",
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "#c8416a"; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(55,45,25,0.10)"; }}
              />
              <button type="submit" disabled={loading || !input.trim()} style={{
                padding: "10px 16px", background: "#c8416a", color: "#fff", border: "none",
                borderRadius: 3, cursor: "pointer", display: "flex", alignItems: "center",
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>

        {/* Video sidebar — Zoom-style layout */}
        <div style={{
          width: 280, borderLeft: "1px solid rgba(55,45,25,0.10)",
          background: "rgba(248,243,232,0.5)", display: "flex", flexDirection: "column",
          flexShrink: 0,
        }}>
          {/* Parent avatar (main feed) */}
          <div style={{ position: "relative", flex: 1 }}>
            <HeyGenAvatar
              className=""
              onAvatarReady={() => {}}
              onAvatarSpeaking={setIsSpeaking}
              onUserMessage={handleUserVoiceMessage}
              onUserSpeaking={handleUserSpeaking}
              speakQueue={speakText}
              onSpeakComplete={() => setSpeakText(null)}
            />

            <div style={{
              position: "absolute", bottom: 8, left: 8, right: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{
                fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase" as const,
                color: "#fff", background: "rgba(0,0,0,0.5)", padding: "3px 8px",
                borderRadius: 3,
              }}>
                {parentName || "Parent"} Tutor
              </div>
              {isSpeaking && (
                <div style={{
                  fontSize: 9, color: "#5a9e76", letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  background: "rgba(0,0,0,0.5)", padding: "3px 8px", borderRadius: 3,
                }}>
                  Speaking...
                </div>
              )}
            </div>

            {/* Kid self-view PiP */}
            <div style={{
              position: "absolute", top: 8, right: 8, width: 96, height: 72,
              borderRadius: 6, overflow: "hidden", border: "2px solid rgba(255,255,255,0.3)",
              background: "#000",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}>
              {webcamOn ? (
                <video
                  ref={selfVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%", height: "100%", objectFit: "cover",
                    transform: "scaleX(-1)", display: "block",
                  }}
                />
              ) : (
                <div style={{
                  width: "100%", height: "100%", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  background: "#1e1a12",
                }}>
                  <VideoOff size={16} style={{ color: "#8a7f6e" }} />
                </div>
              )}
              <div style={{
                position: "absolute", bottom: 2, left: 4,
                fontSize: 8, color: "#fff", letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              }}>
                You
              </div>
            </div>
          </div>

          {/* Stats below video */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(55,45,25,0.10)" }}>
            <div style={{
              padding: "12px", background: "#f8f3e8",
              border: "1px solid rgba(55,45,25,0.08)", borderRadius: 4, textAlign: "center",
            }}>
              <div style={{
                fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" as const,
                color: "#8a7f6e", marginBottom: 4,
              }}>Focus</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: focusColor }}>
                {attention.score}%
              </div>
              <div style={{
                width: "100%", height: 2, background: "rgba(55,45,25,0.08)",
                borderRadius: 1, marginTop: 6, overflow: "hidden",
              }}>
                <div style={{
                  width: `${attention.score}%`, height: "100%",
                  background: focusColor, transition: "width 0.6s ease",
                }} />
              </div>
            </div>

            {attention.webcam && !attention.webcam.webcamEnabled && webcamOn && (
              <div style={{
                fontSize: 10, color: "#c89020", textAlign: "center",
                padding: "8px 10px", background: "rgba(200,144,32,0.06)",
                border: "1px solid rgba(200,144,32,0.15)", borderRadius: 3,
                marginTop: 8,
              }}>
                Webcam permission needed for focus detection
              </div>
            )}
          </div>
        </div>
      </div>

      {showGame && (
        <FlappyQuiz
          topic={documentContext ? "mixed" : "mixed"}
          childAge={childAge}
          onClose={() => setShowGame(false)}
        />
      )}

      <style>{`
        @keyframes vtxBounce {
          0%, 100% { transform: translateY(0) }
          50% { transform: translateY(-6px) }
        }
      `}</style>
    </div>
  );
}

type MathVisualConfig = {
  type: string;
  min?: number;
  max?: number;
  points?: number[];
  label?: string;
  shapes?: Array<{ shape: string; count: number }>;
  numerator?: number;
  denominator?: number;
};
