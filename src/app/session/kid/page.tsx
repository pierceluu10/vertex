"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mic, MicOff, Video, VideoOff } from "lucide-react";
import {
  LiveKitAvatar,
  type LiveTranscriptEntry,
} from "@/components/session/livekit-avatar";
import { useAttention } from "@/hooks/use-attention";
import { getInterventionMessage } from "@/lib/attention";
import { MathVisual } from "@/components/session/math-visual";
import type { AdaptiveState, KidSession } from "@/types";
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastVisualRequestRef = useRef<string | null>(null);

  const childName = kidSession?.child_name?.trim() || "there";

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

  const attention = useAttention(tutoringSessionId || "none", handleIntervention, false);

  const queueInitialGreeting = useCallback((sessionId: string, name: string) => {
    if (greetedSessionIdsRef.current.has(sessionId)) return;

    greetedSessionIdsRef.current.add(sessionId);
    setAgentPromptRequest({
      id: Date.now(),
      text: `Start the session now. Greet ${name} warmly, introduce yourself as Tina, and ask what math problem they want to work on first.`,
    });
  }, []);

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
          queueInitialGreeting(cachedSession.sessionId, session.child_name?.trim() || "there");
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
        if (data.sessionId) {
          queueInitialGreeting(data.sessionId, session.child_name?.trim() || "there");
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
    [documentId, parentId, queueInitialGreeting]
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

  async function endSession() {
    if (kidSessionId) {
      clearCachedLiveSession(getLiveSessionCacheKey(kidSessionId, documentId));
    }

    if (tutoringSessionId) {
      try {
        await fetch("/api/student/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: tutoringSessionId, focusScore: attention.score }),
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

  const focusColor =
    attention.focusLevel === "high"
      ? "#5c7c6a"
      : attention.focusLevel === "medium"
      ? "#c89020"
      : "#c8416a";

  type MathVisualConfig = { type: string; [key: string]: unknown };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "#fef7ee",
        fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
        color: "#1e1a12",
      }}
    >
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

      <main style={{ padding: "22px 20px 28px" }}>
        <div className="vtx-kid-call-layout">
          <section className="vtx-kid-stage-panel">
            <div
              style={{
                padding: 16,
                borderRadius: 28,
                background: "rgba(255,255,255,0.74)",
                border: "1px solid rgba(120, 91, 63, 0.08)",
                boxShadow: "0 18px 40px rgba(94, 70, 48, 0.08)",
              }}
            >
              <div style={{ width: "100%", minHeight: 500 }}>
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
                      minHeight: 500,
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
                    <div style={{ fontSize: 18, fontWeight: 700 }}>Tina is offline</div>
                    <div style={{ maxWidth: 380, fontSize: 13, lineHeight: 1.6, color: "rgba(255,244,230,0.76)" }}>
                      Add the Simli and LiveKit environment variables to bring Tina online as a live call tutor.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="vtx-kid-chat-panel">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "18px 18px 14px",
                borderBottom: "1px solid rgba(120, 91, 63, 0.08)",
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Chat</div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#8a7f6e" }}>
                  Tina&apos;s live speech shows up here, and graphs appear when you ask to see one.
                </div>
              </div>
            </div>

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
                    <span style={{ whiteSpace: "pre-wrap" }}>{message.content}</span>
                    {message.jsxGraph
                      ? (message.jsxGraph as MathVisualConfig[]).map((config, index) => (
                          <MathVisual key={index} config={config} />
                        ))
                      : null}
                  </div>
                </div>
              ))}

              {loading && (
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
                  Start talking to Tina. This panel will mirror the live conversation and show visuals when you ask her to graph or draw something.
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <style>{`
        .vtx-kid-call-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.88fr);
          gap: 20px;
          align-items: start;
        }

        .vtx-kid-stage-panel {
          min-width: 0;
        }

        .vtx-kid-chat-panel {
          min-width: 0;
          min-height: 720px;
          display: flex;
          flex-direction: column;
          border-radius: 28px;
          overflow: hidden;
          background: rgba(255,255,255,0.78);
          border: 1px solid rgba(120, 91, 63, 0.08);
          box-shadow: 0 18px 40px rgba(94, 70, 48, 0.08);
        }

        @media (max-width: 1024px) {
          .vtx-kid-call-layout {
            grid-template-columns: 1fr;
          }

          .vtx-kid-chat-panel {
            min-height: 520px;
          }
        }
      `}</style>

      <style>{`
        @keyframes vtxBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
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
