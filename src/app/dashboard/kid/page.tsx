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
      <main className="kid-dashboard-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 32px", width: "100%", maxWidth: 1000, margin: "0 auto", paddingBottom: 100 }}>
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
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 6, color: "#1a1610" }}>
                {greeting}, {childName}! 👋
              </h1>
              <p style={{ fontSize: 14, color: "#8a7f6e", lineHeight: 1.5 }}>
                Pick something below and let&apos;s make today count.
              </p>
            </div>

            {/* Primary CTA — Start study session */}
            <button
              onClick={() => startTutorSession()}
              style={{
                width: "100%", padding: "24px 20px", marginBottom: 20,
                background: "linear-gradient(135deg, #c8416a 0%, #a83355 100%)",
                border: "none", borderRadius: 16, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 16, textAlign: "left",
                boxShadow: "0 4px 20px rgba(200,65,106,0.25)",
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <MessageCircle size={26} style={{ color: "#fff" }} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: "#fff" }}>Start a study session</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>Chat with your tutor and practice math</div>
              </div>
              <ChevronRight size={22} style={{ color: "rgba(255,255,255,0.8)", marginLeft: "auto" }} />
            </button>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              <div style={{
                padding: "18px 16px", background: "#fff", borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: "rgba(200,144,32,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Flame size={22} style={{ color: "#c89020" }} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#c89020" }}>{streak}</div>
                  <div style={{ fontSize: 11, color: "#8a7f6e" }}>day streak</div>
                </div>
              </div>
              <div style={{
                padding: "18px 16px", background: "#fff", borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: "rgba(200,65,106,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Star size={22} style={{ color: "#c8416a" }} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#c8416a" }}>{xp}</div>
                  <div style={{ fontSize: 11, color: "#8a7f6e" }}>XP earned</div>
                </div>
              </div>
            </div>

            {/* Section: What do you want to do? */}
            <div style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "#8a7f6e", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
                What do you want to do?
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button
                onClick={() => setActiveTab("homework")}
                style={{
                  padding: "20px 14px", background: "#fff", border: "1px solid rgba(0,0,0,0.07)",
                  borderRadius: 14, cursor: "pointer", textAlign: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <Upload size={26} style={{ color: "#c8416a", marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1610" }}>Upload homework</div>
                <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 4 }}>Add a PDF to study from</div>
              </button>
              <button
                onClick={startQuiz}
                disabled={quizLoading}
                style={{
                  padding: "20px 14px", background: "#fff", border: "1px solid rgba(0,0,0,0.07)",
                  borderRadius: 14, cursor: quizLoading ? "not-allowed" : "pointer", textAlign: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)", opacity: quizLoading ? 0.7 : 1,
                }}
              >
                <Sparkles size={26} style={{ color: "#c8416a", marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1610" }}>{quizLoading ? "Loading..." : "Take a quiz"}</div>
                <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 4 }}>Earn XP and test your skills</div>
              </button>
              <button
                onClick={() => setActiveTab("tutor")}
                style={{
                  padding: "20px 14px", background: "#fff", border: "1px solid rgba(0,0,0,0.07)",
                  borderRadius: 14, cursor: "pointer", textAlign: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <MessageCircle size={26} style={{ color: "#c8416a", marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1610" }}>Ask your tutor</div>
                <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 4 }}>Chat and get help with math</div>
              </button>
            </div>

            {/* Tip card */}
            <div style={{
              marginTop: 28, padding: "18px 20px", background: "rgba(200,65,106,0.06)",
              borderRadius: 14, border: "1px solid rgba(200,65,106,0.12)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#c8416a", marginBottom: 6, letterSpacing: "0.05em" }}>
                💡 Tip
              </div>
              <p style={{ fontSize: 13, color: "#5c5248", lineHeight: 1.55, margin: 0 }}>
                Come back every day to keep your streak going. Even 10 minutes of practice helps!
              </p>
            </div>
          </>
        )}

        {/* HOMEWORK TAB */}
        {activeTab === "homework" && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 6, color: "#1a1610" }}>My Homework</h2>
              <p style={{ fontSize: 14, color: "#8a7f6e" }}>
                Upload PDFs here. Your tutor can use them to help you practice.
              </p>
            </div>

            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
              padding: "44px 24px", border: "2px dashed rgba(200,65,106,0.25)", borderRadius: 16,
              background: "rgba(255,255,255,0.8)", cursor: "pointer", marginBottom: 28, textAlign: "center",
              transition: "background 0.2s, border-color 0.2s",
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, background: "rgba(200,65,106,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Upload size={28} style={{ color: "#c8416a" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#c8416a" }}>
                {uploading ? "Uploading..." : "Drop your homework PDF here"}
              </div>
              <div style={{ fontSize: 12, color: "#8a7f6e" }}>or tap to choose a file</div>
              <input type="file" accept=".pdf" style={{ display: "none" }} onChange={handleHomeworkUpload} disabled={uploading} />
            </label>

            {documents.length === 0 ? (
              <div style={{
                padding: "32px 24px", background: "#fff", borderRadius: 16,
                border: "1px solid rgba(0,0,0,0.06)", textAlign: "center",
              }}>
                <BookOpen size={40} style={{ color: "rgba(200,65,106,0.4)", marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 500, color: "#1a1610", marginBottom: 6 }}>No homework yet</div>
                <p style={{ fontSize: 13, color: "#8a7f6e", lineHeight: 1.5, margin: 0 }}>
                  When you upload a PDF, it will show up here. You can then start a study session and ask your tutor about it.
                </p>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#8a7f6e", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                  Your files ({documents.length})
                </div>
                {documents.map((doc) => (
                  <div key={doc.id} style={{
                    padding: "18px 20px", background: "#fff", borderRadius: 14, marginBottom: 12,
                    border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, background: "rgba(200,65,106,0.08)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <FileText size={20} style={{ color: "#c8416a" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1610" }}>{doc.file_name}</div>
                        <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 2 }}>{new Date(doc.uploaded_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <button onClick={() => startTutorSession(doc.id)} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "10px 18px",
                      background: "#c8416a", color: "#fff", border: "none", borderRadius: 10,
                      fontSize: 13, fontWeight: 500, cursor: "pointer",
                    }}>
                      <Play size={14} /> Study
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* QUIZ TAB */}
        {activeTab === "quiz" && (
          <>
            {!quizData ? (
              <div style={{
                padding: "40px 24px", background: "#fff", borderRadius: 16,
                border: "1px solid rgba(0,0,0,0.06)", textAlign: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 20, background: "rgba(200,65,106,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <Sparkles size={36} style={{ color: "#c8416a" }} />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10, color: "#1a1610" }}>Ready for a quiz?</h2>
                <p style={{ fontSize: 14, color: "#8a7f6e", lineHeight: 1.55, marginBottom: 12 }}>
                  You&apos;ll get 5 math questions. Answer correctly to earn 10 XP per question!
                </p>
                <p style={{ fontSize: 13, color: "#8a7f6e", marginBottom: 28 }}>
                  Questions are based on your homework when you have some, or general math practice.
                </p>
                <button onClick={startQuiz} disabled={quizLoading} style={{
                  padding: "16px 36px", background: "linear-gradient(135deg, #c8416a 0%, #a83355 100%)",
                  color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600,
                  cursor: quizLoading ? "not-allowed" : "pointer", boxShadow: "0 4px 16px rgba(200,65,106,0.3)",
                }}>
                  {quizLoading ? "Generating questions..." : "Start quiz"}
                </button>
              </div>
            ) : quizData.done ? (
              <div style={{
                padding: "40px 24px", background: "#fff", borderRadius: 16,
                border: "1px solid rgba(0,0,0,0.06)", textAlign: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
                <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: "#1a1610" }}>Quiz complete!</h2>
                <div style={{ fontSize: 36, fontWeight: 700, color: "#c8416a", marginBottom: 8 }}>
                  {quizData.answers.filter((a) => a.correct).length}/{quizData.questions.length}
                </div>
                <p style={{ fontSize: 14, color: "#8a7f6e", marginBottom: 24 }}>
                  +{quizData.answers.filter((a) => a.correct).length * 10} XP earned! Great job.
                </p>
                <button onClick={() => { setQuizData(null); startQuiz(); }} style={{
                  padding: "14px 28px", background: "linear-gradient(135deg, #c8416a 0%, #a83355 100%)",
                  color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", boxShadow: "0 4px 16px rgba(200,65,106,0.3)",
                }}>
                  Try another quiz
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
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 8, color: "#1a1610" }}>Ask your tutor</h2>
              <p style={{ fontSize: 14, color: "#8a7f6e", lineHeight: 1.5 }}>
                Your tutor can help you with math problems, explain concepts, give hints, and practice with you.
              </p>
            </div>

            <button
              onClick={() => startTutorSession()}
              style={{
                width: "100%", padding: "24px 20px", marginBottom: 28,
                background: "linear-gradient(135deg, #c8416a 0%, #a83355 100%)",
                border: "none", borderRadius: 16, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 16, textAlign: "left",
                boxShadow: "0 4px 20px rgba(200,65,106,0.25)",
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <MessageCircle size={26} style={{ color: "#fff" }} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: "#fff" }}>Start chatting</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>Open a new study session</div>
              </div>
              <ChevronRight size={22} style={{ color: "rgba(255,255,255,0.8)", marginLeft: "auto" }} />
            </button>

            {documents.length > 0 ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#8a7f6e", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                  Or study with a homework file
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {documents.map((doc) => (
                    <button key={doc.id} onClick={() => startTutorSession(doc.id)} style={{
                      display: "flex", alignItems: "center", gap: 14, width: "100%",
                      padding: "16px 18px", background: "#fff", border: "1px solid rgba(0,0,0,0.07)",
                      borderRadius: 14, cursor: "pointer", textAlign: "left",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, background: "rgba(200,65,106,0.08)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <FileText size={20} style={{ color: "#c8416a" }} />
                      </div>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#1a1610" }}>{doc.file_name}</span>
                      <ChevronRight size={18} style={{ color: "#8a7f6e" }} />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{
                padding: "28px 24px", background: "rgba(255,255,255,0.7)", borderRadius: 16,
                border: "1px solid rgba(0,0,0,0.06)", textAlign: "center",
              }}>
                <p style={{ fontSize: 13, color: "#8a7f6e", lineHeight: 1.55, margin: 0 }}>
                  Upload homework in the Homework tab to study with a specific file. Or start chatting above for general help!
                </p>
              </div>
            )}
          </>
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
