"use client";

import { useCallback, useEffect, useState, Component, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Home, BookOpen, Sparkles, MessageCircle, Upload, Flame, Star, FileText, Play, ChevronRight } from "lucide-react";
import type { KidSession, UploadedDocument, Quiz } from "@/types";
import { HeyGenAvatar } from "@/components/session/heygen-avatar";
import "@/styles/vertex.css";

/** Catches SDK/404 errors from HeyGen so the dashboard doesn't crash; shows placeholder instead. */
class AvatarErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

type Tab = "home" | "homework" | "quiz" | "tutor";
type TutorPreview = {
  name: string;
  heygenAvatarId: string | null;
};

export default function KidDashboardPage() {
  const router = useRouter();
  const [kidSession, setKidSession] = useState<KidSession | null>(() => readStoredKidSession());
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [tutor, setTutor] = useState<TutorPreview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizData, setQuizData] = useState<{ questions: Quiz["questions"]; current: number; answers: { answer: string; correct: boolean }[]; done: boolean } | null>(null);

  const loadDocuments = useCallback(async (parentId: string) => {
    try {
      const res = await fetch(`/api/student/homework?parentId=${parentId}`);
      const data = await res.json();
      if (data.documents) setDocuments(data.documents);
    } catch { /* ignore */ }
  }, []);

  const loadTutor = useCallback(async (parentId: string) => {
    try {
      const res = await fetch(`/api/student/tutor?parentId=${parentId}`);
      const data = await res.json();
      if (data.tutor) setTutor(data.tutor);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!kidSession) {
      router.push("/student");
      return;
    }

    // Load homework documents for this kid
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocuments(kidSession.parent_id);
    void loadTutor(kidSession.parent_id);
  }, [kidSession, loadDocuments, loadTutor, router]);

  async function handleHomeworkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !kidSession) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    formData.append("kidSessionId", kidSession.id);
    formData.append("parentId", kidSession.parent_id);

    try {
      const res = await fetch("/api/student/homework", { method: "POST", body: formData });
      if (res.ok) await loadDocuments(kidSession.parent_id);
    } catch { /* ignore */ }
    setUploading(false);
  }

  async function startQuiz() {
    if (!kidSession) return;
    setQuizLoading(true);

    const homeworkContext = documents.length > 0
      ? documents[0].extracted_text?.slice(0, 3000) || ""
      : "";

    try {
      const res = await fetch("/api/student/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kidSessionId: kidSession.id,
          parentId: kidSession.parent_id,
          homeworkContext,
        }),
      });

      const data = await res.json();
      if (data.questions) {
        setQuizData({ questions: data.questions, current: 0, answers: [], done: false });
        setActiveTab("quiz");
      }
    } catch { /* ignore */ }
    setQuizLoading(false);
  }

  function answerQuiz(answer: string) {
    if (!quizData) return;
    const q = quizData.questions[quizData.current];
    const isCorrect = answer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();

    const newAnswers = [...quizData.answers, { answer, correct: isCorrect }];
    const nextIdx = quizData.current + 1;

    if (nextIdx >= quizData.questions.length) {
      setQuizData({ ...quizData, answers: newAnswers, done: true });

      // Save quiz result and award XP
      const score = newAnswers.filter((a) => a.correct).length;
      const xpEarned = score * 10;
      if (kidSession) {
        fetch("/api/student/xp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kidSessionId: kidSession.id, xp: xpEarned }),
        }).then(() => {
          const updated = { ...kidSession, xp_points: kidSession.xp_points + xpEarned };
          setKidSession(updated);
          localStorage.setItem("vertex_kid_session", JSON.stringify(updated));
        });
      }
    } else {
      setQuizData({ ...quizData, current: nextIdx, answers: newAnswers });
    }
  }

  function startTutorSession(documentId?: string) {
    if (!kidSession) return;
    const params = new URLSearchParams({
      kidSessionId: kidSession.id,
      parentId: kidSession.parent_id,
    });
    if (documentId) params.set("documentId", documentId);
    router.push(`/session/kid?${params.toString()}`);
  }

  if (!kidSession) {
    return <div className="vtx-auth-page"><p style={{ color: "#8a7f6e" }}>Loading...</p></div>;
  }

  const greeting = getGreeting();
  const childName = kidSession.child_name?.trim() || "there";
  const streak = kidSession.streak_count || 0;
  const xp = kidSession.xp_points || 0;
  const showTutorPreview = activeTab === "home" || activeTab === "tutor";

  const bottomNav: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <Home size={20} /> },
    { id: "homework", label: "Homework", icon: <BookOpen size={20} /> },
    { id: "quiz", label: "Quiz", icon: <Sparkles size={20} /> },
    { id: "tutor", label: "Ask Tutor", icon: <MessageCircle size={20} /> },
  ];

  return (
    <div style={{
      height: "100vh", overflow: "hidden", background: "linear-gradient(180deg, #fef7ee 0%, #fdf2e6 100%)",
      fontFamily: "'Calibri', 'Trebuchet MS', sans-serif", color: "#1e1a12",
      display: "flex", flexDirection: "column",
    }}>
      {/* Top bar — streak & XP */}
      <header style={{
        padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.7)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#c8416a" }}>
          Vertex
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Flame size={18} style={{ color: "#c89020" }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: "#c89020" }}>{streak}</span>
            <span style={{ fontSize: 11, color: "#8a7f6e" }}>day streak</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Star size={18} style={{ color: "#c8416a" }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: "#c8416a" }}>{xp}</span>
            <span style={{ fontSize: 11, color: "#8a7f6e" }}>XP</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px", maxWidth: 600, margin: "0 auto", width: "100%", paddingBottom: 80 }}>
        {showTutorPreview && (
          <TutorPreviewCard
            childName={childName}
            tutorName={tutor?.name || null}
            avatarName={tutor?.heygenAvatarId || null}
          />
        )}

        {/* HOME TAB */}
        {activeTab === "home" && (
          <>
            <div style={{ textAlign: "center", padding: "32px 0 40px" }}>
              <h1 style={{ fontSize: 28, fontWeight: 400, marginBottom: 8 }}>
                {greeting}, {childName}! 👋
              </h1>
              <p style={{ fontSize: 14, color: "#8a7f6e" }}>
                Ready to learn something awesome today?
              </p>
            </div>

            {/* Streak display */}
            <div style={{
              padding: "20px 24px", background: "linear-gradient(135deg, #fff5e6 0%, #ffe8cc 100%)",
              borderRadius: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 16,
              border: "1px solid rgba(166,124,74,0.2)",
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12, background: "rgba(166,124,74,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Flame size={28} style={{ color: "#c89020" }} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 600, color: "#c89020" }}>{streak} Day Streak!</div>
                <div style={{ fontSize: 12, color: "#8a7f6e" }}>Keep it up — you&apos;re on fire!</div>
              </div>
            </div>

            {/* XP display */}
            <div style={{
              padding: "20px 24px", background: "linear-gradient(135deg, #fef2f5 0%, #fce4ec 100%)",
              borderRadius: 12, marginBottom: 24, display: "flex", alignItems: "center", gap: 16,
              border: "1px solid rgba(158,107,117,0.12)",
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12, background: "rgba(158,107,117,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Star size={28} style={{ color: "#c8416a" }} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 600, color: "#c8416a" }}>{xp} XP</div>
                <div style={{ fontSize: 12, color: "#8a7f6e" }}>Answer questions and take quizzes to earn more!</div>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button
                onClick={() => setActiveTab("homework")}
                style={{
                  padding: "24px 16px", background: "#fff", border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: 12, cursor: "pointer", textAlign: "center", transition: "transform 0.2s",
                }}
              >
                <Upload size={28} style={{ color: "#c8416a", marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 500 }}>Upload Homework</div>
                <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 4 }}>Drop a PDF to study</div>
              </button>
              <button
                onClick={startQuiz}
                disabled={quizLoading}
                style={{
                  padding: "24px 16px", background: "#fff", border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: 12, cursor: "pointer", textAlign: "center", transition: "transform 0.2s",
                }}
              >
                <Sparkles size={28} style={{ color: "#c8416a", marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 500 }}>{quizLoading ? "Loading..." : "Take a Quiz"}</div>
                <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 4 }}>Test your skills</div>
              </button>
            </div>
          </>
        )}

        {/* HOMEWORK TAB */}
        {activeTab === "homework" && (
          <>
            <h2 style={{ fontSize: 24, fontWeight: 400, marginBottom: 24 }}>My Homework</h2>

            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              padding: "40px 24px", border: "2px dashed rgba(158,107,117,0.22)", borderRadius: 12,
              background: "rgba(255,255,255,0.6)", cursor: "pointer", marginBottom: 24, textAlign: "center",
            }}>
              <Upload size={32} style={{ color: "#c8416a" }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: "#c8416a" }}>
                {uploading ? "Uploading..." : "Drop your homework PDF here"}
              </div>
              <div style={{ fontSize: 12, color: "#8a7f6e" }}>or click to choose a file</div>
              <input type="file" accept=".pdf" style={{ display: "none" }} onChange={handleHomeworkUpload} disabled={uploading} />
            </label>

            {documents.map((doc) => (
              <div key={doc.id} style={{
                padding: "16px 20px", background: "#fff", borderRadius: 12, marginBottom: 12,
                border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <FileText size={20} style={{ color: "#c8416a" }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{doc.file_name}</div>
                    <div style={{ fontSize: 11, color: "#8a7f6e" }}>{new Date(doc.uploaded_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <button onClick={() => startTutorSession(doc.id)} style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "8px 16px",
                  background: "#c8416a", color: "#fff", border: "none", borderRadius: 8,
                  fontSize: 12, cursor: "pointer",
                }}>
                  <Play size={12} /> Study
                </button>
              </div>
            ))}
          </>
        )}

        {/* QUIZ TAB */}
        {activeTab === "quiz" && (
          <>
            {!quizData ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <Sparkles size={48} style={{ color: "#c8416a", display: "block" }} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 400, marginBottom: 8 }}>Ready for a quiz?</h2>
                <p style={{ fontSize: 14, color: "#8a7f6e", marginBottom: 24 }}>
                  Test what you know and earn XP!
                </p>
                <button onClick={startQuiz} disabled={quizLoading} style={{
                  padding: "14px 32px", background: "#c8416a", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer",
                }}>
                  {quizLoading ? "Generating questions..." : "Start Quiz"}
                </button>
              </div>
            ) : quizData.done ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
                <h2 style={{ fontSize: 24, fontWeight: 400, marginBottom: 8 }}>Quiz Complete!</h2>
                <div style={{ fontSize: 32, fontWeight: 300, color: "#c8416a", marginBottom: 8 }}>
                  {quizData.answers.filter((a) => a.correct).length}/{quizData.questions.length}
                </div>
                <p style={{ fontSize: 14, color: "#8a7f6e", marginBottom: 8 }}>
                  +{quizData.answers.filter((a) => a.correct).length * 10} XP earned!
                </p>
                <button onClick={() => { setQuizData(null); startQuiz(); }} style={{
                  padding: "12px 24px", background: "#c8416a", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", marginTop: 16,
                }}>
                  Try Another Quiz
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
                  <span style={{ fontSize: 12, color: "#8a7f6e" }}>
                    Question {quizData.current + 1} of {quizData.questions.length}
                  </span>
                  <span style={{ fontSize: 12, color: "#c8416a" }}>
                    {quizData.answers.filter((a) => a.correct).length} correct
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: 4, background: "rgba(0,0,0,0.06)", borderRadius: 2, marginBottom: 32 }}>
                  <div style={{
                    height: "100%", borderRadius: 2, background: "#c8416a",
                    width: `${((quizData.current) / quizData.questions.length) * 100}%`,
                    transition: "width 0.3s",
                  }} />
                </div>

                <div style={{
                  padding: "32px 24px", background: "#fff", borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.06)", marginBottom: 20,
                }}>
                  <p style={{ fontSize: 18, fontWeight: 400, lineHeight: 1.6 }}>
                    {quizData.questions[quizData.current].question}
                  </p>
                </div>

                {quizData.questions[quizData.current].type === "multiple_choice" && quizData.questions[quizData.current].options ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {quizData.questions[quizData.current].options!.map((option, i) => (
                      <button key={i} onClick={() => answerQuiz(option)} style={{
                        padding: "16px 20px", background: "#fff", border: "1.5px solid rgba(0,0,0,0.08)",
                        borderRadius: 10, cursor: "pointer", textAlign: "left", fontSize: 15,
                        transition: "all 0.2s", fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                      }}>
                        <span style={{ color: "#c8416a", fontWeight: 600, marginRight: 12 }}>
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <QuizOpenInput onSubmit={answerQuiz} />
                )}
              </div>
            )}
          </>
        )}

        {/* ASK TUTOR TAB */}
        {activeTab === "tutor" && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <h2 style={{ fontSize: 24, fontWeight: 400, marginBottom: 8 }}>Ask Your Tutor</h2>
            <p style={{ fontSize: 14, color: "#8a7f6e", marginBottom: 24 }}>
              Start a chat session with your AI tutor
            </p>
            <button onClick={() => startTutorSession()} style={{
              padding: "14px 32px", background: "#c8416a", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              <MessageCircle size={16} /> Start Chatting
            </button>

            {documents.length > 0 && (
              <div style={{ marginTop: 32, textAlign: "left" }}>
                <p style={{ fontSize: 12, color: "#8a7f6e", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Or study from your homework:
                </p>
                {documents.slice(0, 3).map((doc) => (
                  <button key={doc.id} onClick={() => startTutorSession(doc.id)} style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%",
                    padding: "14px 16px", background: "#fff", border: "1px solid rgba(0,0,0,0.06)",
                    borderRadius: 10, cursor: "pointer", marginBottom: 8, textAlign: "left",
                  }}>
                    <FileText size={18} style={{ color: "#c8416a" }} />
                    <span style={{ flex: 1, fontSize: 14 }}>{doc.file_name}</span>
                    <ChevronRight size={16} style={{ color: "#8a7f6e" }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        display: "flex", background: "#fff", borderTop: "1px solid rgba(0,0,0,0.06)",
        padding: "8px 0 env(safe-area-inset-bottom, 8px)", zIndex: 50,
      }}>
        {bottomNav.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "8px 0", background: "none", border: "none", cursor: "pointer",
              color: activeTab === item.id ? "#c8416a" : "#8a7f6e", transition: "color 0.2s",
            }}
          >
            {item.icon}
            <span style={{ fontSize: 10, letterSpacing: "0.05em" }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function QuizOpenInput({ onSubmit }: { onSubmit: (answer: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); setValue(""); }} style={{ display: "flex", gap: 8 }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your answer..."
        autoFocus
        style={{
          flex: 1, padding: "14px 16px", border: "1.5px solid rgba(0,0,0,0.08)",
          borderRadius: 10, fontSize: 15, background: "#fff", outline: "none",
          fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
        }}
      />
      <button type="submit" disabled={!value.trim()} style={{
        padding: "14px 20px", background: "#c8416a", color: "#fff",
        border: "none", borderRadius: 10, fontSize: 14, cursor: "pointer",
        opacity: value.trim() ? 1 : 0.4,
      }}>
        Submit
      </button>
    </form>
  );
}

function TutorPreviewCard({
  childName,
  tutorName,
  avatarName,
}: {
  childName: string;
  tutorName: string | null;
  avatarName: string | null;
}) {
  const tutorFirstName = tutorName?.trim().split(" ")[0] || "Your tutor";

  return (
    <div style={{
      marginBottom: 24,
      padding: 20,
      background: "rgba(255,255,255,0.72)",
      border: "1px solid rgba(158,107,117,0.14)",
      borderRadius: 18,
      textAlign: "center",
      boxShadow: "0 20px 48px rgba(158,107,117,0.08)",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 240,
        height: 280,
        margin: "0 auto 16px",
        borderRadius: 16,
        overflow: "hidden",
        background: "#fff",
        border: "1px solid rgba(158,107,117,0.12)",
      }}>
        {avatarName ? (
          <AvatarErrorBoundary
            fallback={
              <div style={{
                width: "100%", height: "100%", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", padding: 20,
                background: "rgba(254,247,238,0.8)", color: "#8a7f6e", fontSize: 12,
                textAlign: "center", lineHeight: 1.5,
              }}>
                <span>Avatar unavailable. Ask your parent to create a new video avatar in Parent Profile.</span>
              </div>
            }
          >
            <HeyGenAvatar
              className="h-full w-full"
              avatarName={avatarName}
              enableVoiceChat={false}
              onAvatarReady={() => {}}
            />
          </AvatarErrorBoundary>
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: 20,
            background: "rgba(254,247,238,0.8)", color: "#8a7f6e", fontSize: 12,
            textAlign: "center", lineHeight: 1.5,
          }}>
            <span>Tutor avatar will appear here once your parent creates a video avatar in Parent Profile.</span>
          </div>
        )}
      </div>
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(200,65,106,0.08)",
        color: "#c8416a",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginBottom: 10,
      }}>
        <MessageCircle size={14} />
        Live Tutor
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#3d3126", margin: 0 }}>
        {tutorFirstName} is ready to help you, {childName}.
      </p>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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
