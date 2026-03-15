"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send, ArrowLeft } from "lucide-react";
import { HeyGenAvatar } from "@/components/session/heygen-avatar";
import { useAttention } from "@/hooks/use-attention";
import { getInterventionMessage } from "@/lib/attention";
import { MathVisual } from "@/components/session/math-visual";
import { MessageContent } from "@/components/session/message-content";
import type { AdaptiveState, KidSession } from "@/types";
import { createInitialAdaptiveState, handleCorrectAnswer, handleIncorrectAnswer, handleDistraction } from "@/lib/adaptive";
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
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tutoringSessionId, setTutoringSessionId] = useState<string | null>(null);
  const [documentContext, setDocumentContext] = useState<string | null>(null);
  const [parentName, setParentName] = useState<string>("");
  const [parentAvatarId, setParentAvatarId] = useState<string | undefined>();
  const [adaptiveState, setAdaptiveState] = useState<AdaptiveState>(createInitialAdaptiveState());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakText, setSpeakText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleIntervention = useCallback((type: string) => {
    const name = kidSession?.child_name?.trim() || "there";
    const message = getInterventionMessage(type, name);
    setMessages((prev) => [...prev, {
      id: `intervention-${Date.now()}`, role: "assistant", content: message, type: "reminder",
    }]);
    if (type === "simplify_and_checkin") setAdaptiveState((prev) => handleDistraction(prev));
    setSpeakText(message);
  }, [kidSession]);

  const attention = useAttention(tutoringSessionId || "none", handleIntervention, false);

  const initSession = useCallback(async (session: KidSession) => {
    try {
      const res = await fetch("/api/student/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kidSessionId: session.id, parentId, documentId }),
      });
      const data = await res.json();
      if (data.sessionId) setTutoringSessionId(data.sessionId);
      if (data.documentContext) setDocumentContext(data.documentContext);
      setParentName(data.parentName || "");
      setParentAvatarId(data.parentAvatarId ?? undefined);

      const greeting = `Hi ${session.child_name?.trim() || "there"}! I'm your math tutor. What would you like to work on today?`;
      setMessages([{ id: "greeting", role: "assistant", content: greeting, type: "chat" }]);
      setSpeakText(greeting);
    } catch { /* ignore */ }
  }, [documentId, parentId]);

  useEffect(() => {
    if (!kidSessionId || !kidSession) { router.push("/dashboard/kid"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initSession(kidSession);
  }, [initSession, kidSession, kidSessionId, router]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  function parseJsxGraph(content: string) {
    const graphs: unknown[] = [];
    const clean = content.replace(/\[JSXGRAPH\]([\s\S]*?)\[\/JSXGRAPH\]/g, (_, json) => {
      try { graphs.push(JSON.parse(json)); } catch { /* skip */ }
      return "";
    });
    return { cleanContent: clean.trim(), graphs };
  }

  async function sendMessage(text: string, type: "chat" | "quiz" | "hint" = "chat") {
    if (!text.trim() || loading) return;
    setLoading(true);
    setInput("");

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: text, type }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: tutoringSessionId,
          message: text,
          messageType: type,
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
          id: `assistant-${Date.now()}`, role: "assistant", content: cleanContent,
          type: data.messageType || "chat", jsxGraph: graphs.length > 0 ? graphs : undefined,
        }]);
        setSpeakText(cleanContent);

        // Award XP for interaction
        if (kidSession) {
          fetch("/api/student/xp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kidSessionId: kidSession.id, xp: 2 }),
          });
        }

        if (data.isCorrect !== undefined) {
          setAdaptiveState((prev) => data.isCorrect ? handleCorrectAnswer(prev) : handleIncorrectAnswer(prev));
        }
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`, role: "assistant", content: "Oops, something went wrong. Try again!", type: "chat",
      }]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  async function endSession() {
    const sessionAverageScore = attention.getSessionAverageScore();
    if (tutoringSessionId) {
      try {
        await fetch("/api/student/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: tutoringSessionId, focusScore: sessionAverageScore }),
        });
      } catch { /* ignore */ }
    }
    router.push("/session/kid/recap?" + new URLSearchParams({
      sessionId: tutoringSessionId || "",
      kidSessionId: kidSessionId || "",
      score: String(sessionAverageScore),
      messages: String(messages.length),
    }).toString());
  }

  const focusColor = attention.focusLevel === "high" ? "#5c7c6a" : attention.focusLevel === "medium" ? "#c89020" : "#c8416a";

  type MathVisualConfig = { type: string; [key: string]: unknown };

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#fef7ee", fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
    }}>
      {/* Header */}
      <header style={{
        padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(244,239,229,0.97)", borderBottom: "1px solid rgba(0,0,0,0.05)",
        backdropFilter: "blur(10px)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={endSession} style={{
            display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
            color: "#8a7f6e", fontSize: 12, cursor: "pointer",
          }}>
            <ArrowLeft size={14} /> End
          </button>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{kidSession?.child_name}&apos;s Study Session</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: focusColor }} />
              <span style={{ fontSize: 11, color: "#8a7f6e" }}>Focus: {attention.score}%</span>
            </div>
          </div>
        </div>
        <div />
      </header>

      {/* Chat + Avatar */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{
                  display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 12,
                }}>
                  <div style={{
                    maxWidth: "80%", padding: "12px 16px", borderRadius: 12, fontSize: 14, lineHeight: 1.65,
                    ...(msg.role === "user"
                      ? { background: "#c8416a", color: "#fff", borderBottomRightRadius: 4 }
                      : msg.type === "reminder"
                      ? { background: "rgba(166,124,74,0.08)", border: "1px solid rgba(166,124,74,0.18)", borderBottomLeftRadius: 4 }
                      : { background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderBottomLeftRadius: 4 }),
                  }}>
                    <MessageContent content={msg.content} />
                    {msg.jsxGraph ? (msg.jsxGraph as MathVisualConfig[]).map((config, i) => (
                      <MathVisual key={i} config={config} />
                    )) : null}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
                  <div style={{
                    background: "#fff", border: "1px solid rgba(0,0,0,0.06)",
                    borderRadius: 12, padding: "12px 16px", display: "flex", gap: 4,
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

          <div style={{
            borderTop: "1px solid rgba(0,0,0,0.05)", background: "rgba(255,255,255,0.7)",
            padding: "12px 24px", flexShrink: 0,
          }}>
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} style={{
              maxWidth: 600, margin: "0 auto", display: "flex", gap: 8,
            }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                disabled={loading}
                autoFocus
                style={{
                  flex: 1, padding: "12px 16px", border: "1.5px solid rgba(0,0,0,0.08)",
                  borderRadius: 10, background: "#fff", fontSize: 14, outline: "none",
                  fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                }}
              />
              <button type="submit" disabled={loading || !input.trim()} style={{
                padding: "12px 18px", background: "#c8416a", color: "#fff", border: "none",
                borderRadius: 10, cursor: "pointer", opacity: loading || !input.trim() ? 0.4 : 1,
              }}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>

        {/* Avatar sidebar */}
        <div style={{
          width: 200, borderLeft: "1px solid rgba(0,0,0,0.05)", background: "rgba(255,255,255,0.5)",
          display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 12px", gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ width: "100%", height: 240, borderRadius: 16, overflow: "hidden" }}>
            {parentAvatarId ? (
              <HeyGenAvatar
                className="h-full w-full"
                avatarName={parentAvatarId}
                onAvatarReady={() => {}}
                onAvatarSpeaking={setIsSpeaking}
                speakQueue={speakText}
                onSpeakComplete={() => setSpeakText(null)}
              />
            ) : (
              <div style={{
                width: "100%", height: "100%", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", padding: 16,
                background: "rgba(244,239,229,0.9)", color: "#8a7f6e", fontSize: 11,
                textAlign: "center", lineHeight: 1.5,
              }}>
                <span>Tutor avatar isn&apos;t set up.</span>
                <span style={{ marginTop: 4 }}>Ask your parent to create a video avatar in Parent Profile so sessions use their likeness.</span>
              </div>
            )}
          </div>
          <div style={{
            fontSize: 12, fontWeight: 500, color: "#1e1a12", textAlign: "center",
          }}>
            {parentName ? `${parentName.split(" ")[0]}'s tutor` : "Parent tutor"}
          </div>
          {isSpeaking && (
            <div style={{ fontSize: 10, color: "#5c7c6a", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Speaking...
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes vtxBounce { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }`}</style>
    </div>
  );
}

export default function KidSessionPage() {
  return (
    <Suspense fallback={<div className="vtx-auth-page"><p style={{ color: "#8a7f6e" }}>Loading session...</p></div>}>
      <KidSessionContent />
    </Suspense>
  );
}

function readStoredKidSession(): KidSession | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem("vertex_kid_session");
    return stored ? JSON.parse(stored) as KidSession : null;
  } catch {
    return null;
  }
}
