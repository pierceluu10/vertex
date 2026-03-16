"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  BookOpen,
  Sparkles,
  MessageCircle,
  FileText,
  Play,
  ChevronRight,
  ListTodo,
  BarChart3,
  MessageSquare,
  Plus,
  Check,
  Trash2,
  User,
  ArrowLeft,
  Target,
  Lock,
  Clock,
  Trophy,
  Sun,
  CloudSun,
  MoonStar,
  Flame,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ParentAvatar } from "@/components/session/parent-avatar";
import { VertexLogo } from "@/components/vertex/vertex-logo";
import type { KidSession, UploadedDocument, Quiz, TutoringSession } from "@/types";
import "@/styles/vertex.css";

const TODO_STORAGE_KEY = "vertex_kid_todos";

type Tab = "home" | "profile";
type HomeView = "main" | "homework" | "quiz";

const stagger = {
  hidden: { opacity: 0 },
  show: (i: number) => ({
    opacity: 1,
    transition: { delay: i * 0.04, duration: 0.28, ease: "easeOut" as const },
  }),
};

const tabTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

export default function KidDashboardPage() {
  const router = useRouter();
  // Initialize as null to avoid hydration mismatch — localStorage is read in useEffect below
  const [kidSession, setKidSession] = useState<KidSession | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [homeView, setHomeView] = useState<HomeView>("main");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizData, setQuizData] = useState<{
    questions: Quiz["questions"];
    current: number;
    answers: { answer: string; correct: boolean }[];
    done: boolean;
  } | null>(null);
  const [sessions, setSessions] = useState<TutoringSession[]>([]);
  const [todos, setTodos] = useState<{ id: string; label: string; done: boolean }[]>(() => []);
  const [todoInput, setTodoInput] = useState("");

  // Mastery state
  const [masteryData, setMasteryData] = useState<{
    strengths: { topic: string; confidence: number; label: string; tier: string }[];
    weaknesses: { topic: string; confidence: number; label: string; isStale: boolean }[];
    hasData: boolean;
  } | null>(null);
  const [masteryLoading, setMasteryLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    try {
      const childId = readStoredKidSession()?.child_id;
      if (!childId) {
        setDocuments([]);
        return;
      }
      const res = await fetch(`/api/student/homework?childId=${encodeURIComponent(childId)}`);
      const data = await res.json();
      if (data.documents) setDocuments(data.documents);
    } catch { /* ignore */ }
  }, []);

  const loadSessions = useCallback(async (kidSessionId: string) => {
    try {
      const res = await fetch(`/api/student/sessions?kidSessionId=${encodeURIComponent(kidSessionId)}`);
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions);
    } catch { /* ignore */ }
  }, []);

  const loadMastery = useCallback(async (kidSessionId: string) => {
    try {
      const res = await fetch(`/api/student/mastery?kidSessionId=${encodeURIComponent(kidSessionId)}`);
      const data = await res.json();
      setMasteryData(data);
    } catch { /* ignore */ }
    finally { setMasteryLoading(false); }
  }, []);

  // Read session from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const session = readStoredKidSession();
    setKidSession(session);
    setMounted(true);
  }, []);

  // Load data once we have the session, or redirect if no session after mount
  useEffect(() => {
    if (!mounted) return;
    if (!kidSession) {
      router.push("/student");
      return;
    }
    void loadDocuments();
    void loadSessions(kidSession.id);
    void loadMastery(kidSession.id);
    try {
      const raw = localStorage.getItem(`${TODO_STORAGE_KEY}_${kidSession.id}`);
      if (raw) setTodos(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [mounted, kidSession, loadDocuments, loadSessions, loadMastery, router]);

  // Refetch sessions and documents when user returns to the tab so "How you're doing" stays up to date
  useEffect(() => {
    if (!kidSession) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadSessions(kidSession!.id);
        loadDocuments();
      }
    };
    window.addEventListener("visibilitychange", onVisible);
    return () => window.removeEventListener("visibilitychange", onVisible);
  }, [kidSession, loadSessions, loadDocuments]);

  function saveTodos(next: { id: string; label: string; done: boolean }[]) {
    setTodos(next);
    if (kidSession) {
      try {
        localStorage.setItem(`${TODO_STORAGE_KEY}_${kidSession.id}`, JSON.stringify(next));
      } catch { /* ignore */ }
    }
  }

  function addTodo() {
    const label = todoInput.trim();
    if (!label) return;
    const next = [...todos, { id: crypto.randomUUID(), label, done: false }];
    saveTodos(next);
    setTodoInput("");
  }

  function toggleTodo(id: string) {
    saveTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function removeTodo(id: string) {
    saveTodos(todos.filter((t) => t.id !== id));
  }

  async function startQuiz() {
    if (!kidSession) return;
    setQuizLoading(true);
    const homeworkContext =
      documents.length > 0 ? documents[0].extracted_text?.slice(0, 3000) || "" : "";
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
        setQuizData({
          questions: data.questions,
          current: 0,
          answers: [],
          done: false,
        });
        setHomeView("quiz");
      }
    } catch { /* ignore */ }
    setQuizLoading(false);
  }

  function answerQuiz(answer: string) {
    if (!quizData || !kidSession) return;
    const q = quizData.questions[quizData.current];
    const isCorrect =
      answer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();
    const newAnswers = [...quizData.answers, { answer, correct: isCorrect }];

    const nextIdx = quizData.current + 1;
    if (nextIdx >= quizData.questions.length) {
      setQuizData({ ...quizData, answers: newAnswers, done: true });
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
    if (documentId) {
      params.set("documentId", documentId);
    }
    router.push(`/session/kid?${params.toString()}`);
  }

  if (!kidSession) {
    return (
      <div className="vtx-auth-page">
        <p className="vtx-kid-subtitle" style={{ margin: 0 }}>Loading…</p>
      </div>
    );
  }

  const { greeting, icon, motivational } = getGreetingData();
  const childName = kidSession.child_name?.trim() || "there";
  const tutorDisplayName = "Pierce";
  const streak = kidSession.streak_count || 0;
  const xp = kidSession.xp_points || 0;

  /* Computed stats */
  const sessionsThisWeek = sessions.filter((s) => {
    const d = new Date(s.started_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }).length;

  const avgFocus = (() => {
    const completed = sessions.filter((s) => s.status === "completed" && s.focus_score_avg != null);
    if (completed.length === 0) return null;
    return Math.round(completed.reduce((a, s) => a + (s.focus_score_avg ?? 0), 0) / completed.length);
  })();

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <Home size={18} /> },
    { id: "profile", label: "Sign Up", icon: <User size={18} /> },
  ];

  return (
    <div className="vtx-kid-page vtx-kid-ui flex h-screen flex-col overflow-hidden">
      <header className="vtx-kid-header">
        <VertexLogo href="/" height={52} className="vtx-kid-logo" />
      </header>

      <div className="kid-dashboard-scroll flex-1 min-h-0 overflow-y-auto">
        <div className={cn("vtx-kid-scroll-padding", activeTab === "home" && homeView === "main" && "vtx-kid-fit-viewport")}>
          <div className="vtx-kid-content">
          <AnimatePresence mode="wait">
            {activeTab === "home" && homeView === "main" && (
              <motion.div key="home" {...tabTransition} className="vtx-kid-home-layout">
                <div className="vtx-kid-home-left">
                  <motion.span className="vtx-kid-section-num" variants={stagger} initial="hidden" animate="show" custom={0}>
                    Dashboard
                  </motion.span>
                  <motion.h1 className="vtx-kid-section-title" variants={stagger} initial="hidden" animate="show" custom={1}>
                    <span className="vtx-kid-greeting-emoji">{icon}</span>
                    {greeting}, <em>{childName}</em>.
                  </motion.h1>
                  <motion.p className="vtx-kid-motivational" variants={stagger} initial="hidden" animate="show" custom={2}>
                    {motivational}
                  </motion.p>

                  <motion.button type="button" className="vtx-kid-cta" onClick={() => startTutorSession()} variants={stagger} initial="hidden" animate="show" custom={3}>
                    <div className="vtx-kid-cta-icon"><MessageCircle size={20} style={{ color: "var(--vtx-pink, #c8416a)" }} /></div>
                    <div className="vtx-kid-cta-text">
                      <div className="vtx-kid-cta-title">Study with tutor</div>
                      <div className="vtx-kid-cta-desc">Practice math with your tutor.</div>
                    </div>
                    <ChevronRight size={18} style={{ color: "var(--vtx-muted, #8a7f6e)" }} />
                  </motion.button>

                  <div className="vtx-kid-home-grid">
                    <motion.div className="vtx-kid-home-main-panel" variants={stagger} initial="hidden" animate="show" custom={4}>
                      <div className="vtx-kid-panel-head">
                        <div>
                          <span className="vtx-kid-panel-kicker">Growth snapshot</span>
                          <h3 className="vtx-kid-panel-title">See what&apos;s getting stronger</h3>
                        </div>
                        <span className="vtx-kid-panel-meta">
                          {masteryData?.hasData ? "Recent learning trends" : "Complete a session to unlock"}
                        </span>
                      </div>

                      {masteryLoading ? (
                        <motion.div style={{ display: "flex", gap: 12 }} variants={stagger} initial="hidden" animate="show" custom={4}>
                          <motion.div style={{ flex: 1, height: 96, background: "rgba(0,0,0,0.03)", borderRadius: 16, animation: "pulse 2s infinite" }} variants={stagger} custom={4} />
                          <motion.div style={{ flex: 1, height: 96, background: "rgba(0,0,0,0.03)", borderRadius: 16, animation: "pulse 2s infinite" }} variants={stagger} custom={5} />
                        </motion.div>
                      ) : masteryData?.hasData ? (
                        <motion.div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} variants={stagger} initial="hidden" animate="show" custom={4}>
                          {masteryData.strengths.length > 0 && (
                            <motion.div variants={stagger} initial="hidden" animate="show" custom={5}>
                              <span style={{ display: "block", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "#8a7f6e", marginBottom: 10 }}>
                                Strengths
                              </span>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {masteryData.strengths.map((t, i) => (
                                  <motion.div key={t.topic} style={{
                                    display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
                                    background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 12
                                  }} variants={stagger} initial="hidden" animate="show" custom={6 + i}>
                                    <div style={{
                                      width: 36, height: 36, borderRadius: "50%", background: "rgba(245,158,11,0.15)",
                                      display: "flex", alignItems: "center", justifyContent: "center"
                                    }}>
                                      {t.tier === "fire" ? <Sparkles size={16} style={{ color: "#f59e0b" }} /> : <Trophy size={16} style={{ color: "#d97706" }} />}
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 15, fontWeight: 600, color: "#92400e" }}>{t.topic}</div>
                                      <div style={{ fontSize: 12, color: "#b45309" }}>{t.label}</div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )}

                          {masteryData.weaknesses.length > 0 && (
                            <motion.div variants={stagger} initial="hidden" animate="show" custom={6}>
                              <span style={{ display: "block", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "#8a7f6e", marginBottom: 10 }}>
                                Needs Work
                              </span>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {masteryData.weaknesses.map((t, i) => (
                                  <motion.div key={t.topic} style={{
                                    display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
                                    background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)", borderRadius: 12
                                  }} variants={stagger} initial="hidden" animate="show" custom={7 + i}>
                                    <div style={{
                                      width: 36, height: 36, borderRadius: "50%", background: "rgba(139,92,246,0.1)",
                                      display: "flex", alignItems: "center", justifyContent: "center"
                                    }}>
                                      {t.isStale ? <Clock size={16} style={{ color: "#7c3aed" }} /> : <Target size={16} style={{ color: "#8b5cf6" }} />}
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 15, fontWeight: 600, color: "#5b21b6" }}>{t.topic}</div>
                                      <div style={{ fontSize: 12, color: "#7c3aed" }}>{t.label}</div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div
                          className="vtx-kid-unlock-card"
                          variants={stagger}
                          initial="hidden"
                          animate="show"
                          custom={4}
                        >
                          <Lock size={28} style={{ color: "#8a7f6e", margin: "0 auto 10px" }} />
                          <div style={{ fontSize: 18, fontWeight: 600, color: "#1a1610", marginBottom: 6 }}>Unlock your stats</div>
                          <div style={{ fontSize: 15, color: "#8a7f6e" }}>Finish your first study session to see your progress here.</div>
                        </motion.div>
                      )}
                    </motion.div>

                    <motion.div className="vtx-kid-agent-panel vtx-kid-agent-panel-large" variants={stagger} initial="hidden" animate="show" custom={5}>
                      <span className="vtx-kid-agent-label">Your tutor</span>
                      <div className="vtx-kid-agent-avatar-wrap">
                        <ParentAvatar
                          parentName={tutorDisplayName}
                          focusLevel="high"
                          isSpeaking={false}
                        />
                      </div>
                      <p className="vtx-kid-agent-desc">
                        Pierce is ready to help you with math, {childName}. Start a session above to chat.
                      </p>
                    </motion.div>

                    <motion.div className="vtx-kid-sidebar-block vtx-kid-progress-panel" variants={stagger} initial="hidden" animate="show" custom={6}>
                      <div className="vtx-kid-sidebar-heading">
                        <BarChart3 size={16} style={{ color: "#8b5cf6" }} />
                        <span>How you&apos;re doing</span>
                      </div>

                      {avgFocus !== null && (
                        <div className="vtx-kid-progress-ring" style={{ marginBottom: 20 }}>
                          <ProgressRing value={avgFocus} />
                          <div className="vtx-kid-progress-ring-label">
                            <span className="vtx-kid-progress-ring-value">{avgFocus}%</span>
                            <span className="vtx-kid-progress-ring-text">Avg focus</span>
                          </div>
                        </div>
                      )}

                      <div className="vtx-kid-stats-mini">
                        <div className="vtx-kid-stat-mini">
                          <span className="vtx-kid-stat-mini-value">{sessionsThisWeek}</span>
                          <span className="vtx-kid-stat-mini-label">Sessions this week</span>
                          <div className="vtx-kid-stat-bar">
                            <div className="vtx-kid-stat-bar-fill" style={{ width: `${Math.min(sessionsThisWeek * 14, 100)}%` }} />
                          </div>
                        </div>
                        {avgFocus === null && (
                          <div className="vtx-kid-stat-mini">
                            <span className="vtx-kid-stat-mini-value">—</span>
                            <span className="vtx-kid-stat-mini-label">Avg focus</span>
                          </div>
                        )}
                        <div className="vtx-kid-stat-mini">
                          <span className="vtx-kid-stat-mini-value">{documents.length}</span>
                          <span className="vtx-kid-stat-mini-label">Homework files</span>
                          <div className="vtx-kid-stat-bar">
                            <div className="vtx-kid-stat-bar-fill" style={{ width: `${Math.min(documents.length * 20, 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    <motion.button
                      type="button"
                      onClick={() => setHomeView("homework")}
                      className="vtx-kid-homework-panel"
                      variants={stagger}
                      initial="hidden"
                      animate="show"
                      custom={7}
                    >
                      <div className="vtx-kid-homework-panel-icon">
                        <BookOpen size={22} />
                      </div>
                      <div className="vtx-kid-homework-panel-copy">
                        <span className="vtx-kid-homework-panel-kicker">Homework</span>
                        <div className="vtx-kid-homework-panel-title">Open your practice files</div>
                        <div className="vtx-kid-homework-panel-desc">
                          Review uploaded work, then jump straight into a lesson when you&apos;re ready.
                        </div>
                      </div>
                      <div className="vtx-kid-homework-panel-meta">
                        <span className="vtx-kid-homework-panel-count">{documents.length}</span>
                        <ArrowUpRight size={18} />
                      </div>
                    </motion.button>
                  </div>
                </div>

                <aside className="vtx-kid-home-right">
                  <motion.div className="vtx-kid-sidebar-block" variants={stagger} initial="hidden" animate="show" custom={8}>
                    <div className="vtx-kid-sidebar-heading" style={{ marginBottom: 18 }}>
                      <ListTodo size={16} style={{ color: "var(--vtx-pink, #c8416a)" }} />
                      <span>To-do</span>
                    </div>
                    <div className="vtx-kid-todo-form">
                      <input
                        type="text"
                        className="vtx-kid-todo-input"
                        placeholder="Add a task…"
                        value={todoInput}
                        onChange={(e) => setTodoInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTodo())}
                      />
                      <button type="button" className="vtx-kid-todo-add" onClick={addTodo} aria-label="Add todo">
                        <Plus size={16} />
                      </button>
                    </div>
                    <ul className="vtx-kid-todo-list">
                      {todos.map((t) => (
                        <li key={t.id} className="vtx-kid-todo-item">
                          <button type="button" className={cn("vtx-kid-todo-check", t.done && "done")} onClick={() => toggleTodo(t.id)} aria-label={t.done ? "Mark undone" : "Mark done"}>
                            {t.done ? <Check size={14} /> : null}
                          </button>
                          <span className={cn("vtx-kid-todo-label", t.done && "done")}>{t.label}</span>
                          <button type="button" className="vtx-kid-todo-remove" onClick={() => removeTodo(t.id)} aria-label="Remove">
                            <Trash2 size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {todos.length === 0 && <p className="vtx-kid-sidebar-muted">No tasks yet. Add one above.</p>}
                  </motion.div>

                  <motion.div className="vtx-kid-sidebar-block" variants={stagger} initial="hidden" animate="show" custom={9}>
                    <div className="vtx-kid-sidebar-heading">
                      <MessageSquare size={16} style={{ color: "#3b82f6" }} />
                      <span>Past study sessions</span>
                    </div>
                    <ul className="vtx-kid-past-list">
                      {sessions.slice(0, 5).map((s) => (
                        <li key={s.id} className="vtx-kid-past-item">
                          <div className="vtx-kid-past-main">
                            <span className="vtx-kid-past-date">{new Date(s.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            <span className="vtx-kid-past-status">{s.status === "completed" ? "Completed" : s.status === "active" ? "In progress" : s.status}</span>
                          </div>
                          {s.ended_at && s.started_at && (
                            <span className="vtx-kid-past-duration">
                              {Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)} min
                            </span>
                          )}
                          {s.focus_score_avg != null && s.status === "completed" && (
                            <span className="vtx-kid-past-focus">{Math.round(s.focus_score_avg)}% focus</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {sessions.length === 0 && <p className="vtx-kid-sidebar-muted">No sessions yet. Start one above.</p>}
                  </motion.div>
                </aside>
              </motion.div>
            )}

            {activeTab === "home" && homeView === "homework" && (
              <motion.div key="homework" {...tabTransition}>
                <button type="button" className="vtx-kid-back" onClick={() => setHomeView("main")}>
                  <ArrowLeft size={16} /> Back to Home
                </button>
                <span className="vtx-kid-section-num">Homework</span>
                <h2 className="vtx-kid-section-title">My <em>Homework</em></h2>
                <p className="vtx-kid-subtitle">These are the PDFs your parent uploaded for your study sessions.</p>

                {documents.length === 0 ? (
                  <div className="vtx-kid-empty">
                    <BookOpen size={36} style={{ color: "rgba(200,65,106,0.35)" }} />
                    <div className="vtx-kid-empty-title">No homework yet</div>
                    <p>Your parent can upload homework PDFs, and they will show up here once ready.</p>
                  </div>
                ) : (
                  <>
                    <div className="vtx-kid-doc-list-label">Your files ({documents.length})</div>
                    {documents.map((doc, i) => (
                      <motion.div key={doc.id} className="vtx-kid-doc-item" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                        <div className="vtx-kid-doc-info">
                          <div className="vtx-kid-doc-icon"><FileText size={18} style={{ color: "var(--vtx-pink, #c8416a)" }} /></div>
                          <div>
                            <div className="vtx-kid-doc-name">{doc.file_name}</div>
                            <div className="vtx-kid-doc-date">
                              {new Date(doc.uploaded_at).toLocaleDateString()}
                              {doc.lesson_plan && (
                                <span style={{ marginLeft: 8, color: "#4aaa6a", fontWeight: 600, fontSize: 10 }}>● Lesson Ready</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button type="button" className="vtx-kid-doc-btn" onClick={() => startTutorSession(doc.id)}>
                          <Play size={12} /> {doc.lesson_plan ? "Start Lesson" : "Study"}
                        </button>
                      </motion.div>
                    ))}
                  </>
                )}
              </motion.div>
            )}

            {activeTab === "home" && homeView === "quiz" && (
              <motion.div key="quiz" {...tabTransition}>
                {!quizData ? (
                  <div className="vtx-kid-quiz-card">
                    <button type="button" className="vtx-kid-back" onClick={() => setHomeView("main")} style={{ marginBottom: 16 }}>
                      <ArrowLeft size={16} /> Back to Home
                    </button>
                    <div className="vtx-kid-quiz-icon"><Sparkles size={28} style={{ color: "var(--vtx-pink, #c8416a)" }} /></div>
                    <h2 className="vtx-kid-quiz-title">Ready for a quiz?</h2>
                    <p className="vtx-kid-quiz-desc">You&apos;ll get 5 math questions. Questions are based on your homework when you have some, or general math practice.</p>
                    <button type="button" className="vtx-kid-quiz-btn" onClick={startQuiz} disabled={quizLoading}>
                      {quizLoading ? "Generating questions…" : "Start quiz"}
                    </button>
                  </div>
                ) : quizData.done ? (
                  <div className="vtx-kid-quiz-card">
                    <span className="vtx-kid-section-num">Complete</span>
                    <h2 className="vtx-kid-quiz-title">Quiz complete, {childName}!</h2>
                    <div className="vtx-kid-quiz-result">
                      {quizData.answers.filter((a) => a.correct).length}/{quizData.questions.length}
                    </div>
                    <p className="vtx-kid-quiz-desc">
                      {quizData.answers.filter((a) => a.correct).length}/{quizData.questions.length} correct
                    </p>
                    <button type="button" className="vtx-kid-quiz-btn" onClick={() => { setQuizData(null); startQuiz(); }}>
                      Try another quiz
                    </button>
                    <button type="button" className="vtx-kid-back" onClick={() => { setQuizData(null); setHomeView("main"); }} style={{ marginTop: 16 }}>
                      <ArrowLeft size={16} /> Back to Home
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="vtx-kid-quiz-progress-bar">
                      <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--vtx-muted, #8a7f6e)" }}>
                        Question {quizData.current + 1} of {quizData.questions.length}
                      </span>
                      <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--vtx-pink, #c8416a)" }}>
                        {quizData.answers.filter((a) => a.correct).length} correct
                      </span>
                    </div>
                    <div className="vtx-kid-quiz-progress-track">
                      <motion.div
                        className="vtx-kid-quiz-progress-fill"
                        animate={{ width: `${(quizData.current / quizData.questions.length) * 100}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                    <motion.div className="vtx-kid-quiz-question" key={quizData.current} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                      <p>{quizData.questions[quizData.current].question}</p>
                    </motion.div>
                    {quizData.questions[quizData.current].type === "multiple_choice" && quizData.questions[quizData.current].options ? (
                      <div className="vtx-kid-quiz-options">
                        {quizData.questions[quizData.current].options!.map((option, i) => (
                          <button key={i} type="button" className="vtx-kid-quiz-option" onClick={() => answerQuiz(option)}>
                            <span className="vtx-kid-quiz-option-letter">{String.fromCharCode(65 + i)}.</span>
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <QuizOpenInput onSubmit={answerQuiz} />
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "profile" && (
              <motion.div key="profile" {...tabTransition}>
                <span className="vtx-kid-section-num">Profile</span>
                <h2 className="vtx-kid-section-title">Your <em>profile</em></h2>
                <p className="vtx-kid-subtitle">Signed in as {childName}.</p>
                <div className="vtx-kid-profile-block">
                  {/* Profile avatar */}
                  <div className="vtx-kid-profile-avatar">
                    <span className="vtx-kid-profile-avatar-text">
                      {childName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </span>
                  </div>

                  <div className="vtx-kid-profile-row">
                    <span className="vtx-kid-profile-label">Name</span>
                    <span className="vtx-kid-profile-value">{childName}</span>
                  </div>

                  {/* Streak & XP stats on profile */}
                  <div className="vtx-kid-profile-stats">
                    <div className="vtx-kid-profile-stat">
                      <Flame className="vtx-kid-profile-stat-icon" style={{ color: "#ef4444" }} />
                      <span className="vtx-kid-profile-stat-value">{streak}</span>
                      <span className="vtx-kid-profile-stat-label">Streak</span>
                    </div>
                    <div className="vtx-kid-profile-stat">
                      <Zap className="vtx-kid-profile-stat-icon" style={{ color: "#f59e0b" }} />
                      <span className="vtx-kid-profile-stat-value">{xp}</span>
                      <span className="vtx-kid-profile-stat-label">XP</span>
                    </div>
                    <div className="vtx-kid-profile-stat">
                      <BookOpen className="vtx-kid-profile-stat-icon" style={{ color: "#3b82f6" }} />
                      <span className="vtx-kid-profile-stat-value">{sessions.length}</span>
                      <span className="vtx-kid-profile-stat-label">Sessions</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="vtx-kid-quiz-btn"
                    style={{ marginTop: 24 }}
                    onClick={() => {
                      try {
                        localStorage.removeItem("vertex_kid_session");
                      } catch { /* ignore */ }
                      router.push("/student");
                    }}
                  >
                    Leave and use another code
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom nav with active pill */}
      <nav className="vtx-kid-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`vtx-kid-nav-item${activeTab === item.id ? " active" : ""}`}
            onClick={() => {
              if (item.id === "profile") {
                router.push("/dashboard/kid/profile");
                return;
              }
              if (item.id === "home") setHomeView("main");
              setActiveTab(item.id);
            }}
          >
            {activeTab === item.id && (
              <motion.div
                className="vtx-kid-nav-pill"
                layoutId="nav-pill"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ─── Progress Ring SVG ─── */
function ProgressRing({ value }: { value: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg className="vtx-kid-progress-ring-svg" viewBox="0 0 64 64">
      <circle className="vtx-kid-progress-ring-bg" cx="32" cy="32" r={radius} />
      <circle
        className="vtx-kid-progress-ring-fill"
        cx="32"
        cy="32"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function QuizOpenInput({ onSubmit }: { onSubmit: (answer: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="vtx-kid-quiz-input-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) {
          onSubmit(value.trim());
          setValue("");
        }
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your answer..."
        autoFocus
        className="vtx-kid-quiz-input"
      />
      <button type="submit" disabled={!value.trim()} className="vtx-kid-quiz-submit">
        Submit
      </button>
    </form>
  );
}

function getGreetingData(): { greeting: string; icon: React.ReactNode; motivational: string } {
  const hour = new Date().getHours();
  const motivationals = [
    "Ready to learn something new today?",
    "Keep up the amazing work!",
    "You're doing great — let's keep going!",
    "Every problem you solve makes you stronger!",
    "Today is a great day to grow your brain!",
  ];
  const motivational = motivationals[Math.floor(Date.now() / 86400000) % motivationals.length];

  if (hour < 12) return { greeting: "Good morning", icon: <Sun style={{ color: "#eab308" }} />, motivational };
  if (hour < 17) return { greeting: "Good afternoon", icon: <CloudSun style={{ color: "#60a5fa" }} />, motivational };
  return { greeting: "Good evening", icon: <MoonStar style={{ color: "#818cf8" }} />, motivational };
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
