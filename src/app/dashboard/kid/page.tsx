"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  BookOpen,
  Sparkles,
  MessageCircle,
  Upload,
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
  ArrowRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ParentAvatar } from "@/components/session/parent-avatar";
import type { KidSession, UploadedDocument, Quiz, TutoringSession } from "@/types";
import "@/styles/vertex.css";

const TODO_STORAGE_KEY = "vertex_kid_todos";
const STREAK_STORAGE_KEY = "vertex_kid_streak";
const XP_STORAGE_KEY = "vertex_kid_xp";

type Tab = "home" | "study" | "profile";
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

/* ─── Daily challenge prompts ─── */
const DAILY_CHALLENGES = [
  "Try solving 3 multiplication problems without a calculator today!",
  "Can you find 5 different ways to make the number 24 using +, -, ×, ÷?",
  "What's the biggest number you can make with the digits 3, 7, and 5?",
  "Try to estimate how many steps it takes to walk around your house!",
  "Draw a shape with exactly 5 sides. What's it called?",
  "Count by 7s as high as you can go!",
  "What fraction of your day do you spend sleeping?",
  "Find 3 objects at home that are shaped like cylinders.",
  "If you had 100 coins, how many ways could you split them into equal groups?",
  "Measure something using only your hand span. How many spans is it?",
  "What's half of half of 100?",
  "Try to add up all the numbers from 1 to 10 in your head!",
  "How many rectangles can you spot in your room right now?",
  "If you save $2 a day, how much will you have after a month?",
  "What's the next number in this pattern: 2, 6, 12, 20, __?",
  "Draw a symmetrical butterfly using only triangles!",
  "Estimate how tall you are in centimeters. Then measure to check!",
  "How many minutes are in a full day?",
  "Create your own word problem for a friend to solve.",
  "Find 3 things that weigh about the same as 1 kilogram.",
  "What shape has the most sides that you know? Draw it!",
  "Skip count by 9s — do you notice a pattern in the digits?",
  "If a pizza has 8 slices and you eat 3, what fraction is left?",
  "Time yourself: how long can you hold your breath? Round to the nearest 5 seconds.",
  "What's 15% of 200? Try to figure it out without paper!",
  "Build something using exactly 10 blocks or LEGO pieces.",
  "How many different 3-digit numbers can you make with 1, 2, and 3?",
  "Estimate how many grains of rice fit in a cup.",
  "What's the perimeter of your desk or table?",
  "Draw a graph of your mood throughout the day!",
];

/* ─── Confetti colors ─── */
const CONFETTI_COLORS = ["#c8416a", "#e8a87c", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"];

function generateConfettiPieces(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${40 + Math.random() * 30}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    driftX: `${(Math.random() - 0.5) * 200}px`,
    driftY: `${-80 - Math.random() * 160}px`,
    driftR: `${(Math.random() - 0.5) * 720}deg`,
    delay: `${Math.random() * 0.3}s`,
    width: `${6 + Math.random() * 8}px`,
    height: `${6 + Math.random() * 8}px`,
    borderRadius: Math.random() > 0.5 ? "50%" : "2px",
  }));
}

export default function KidDashboardPage() {
  const router = useRouter();
  // Initialize as null to avoid hydration mismatch — localStorage is read in useEffect below
  const [kidSession, setKidSession] = useState<KidSession | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [homeView, setHomeView] = useState<HomeView>("main");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
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
  const [tutorName, setTutorName] = useState<string>("");
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const confettiPieces = useMemo(() => generateConfettiPieces(40), []);

  /* ─── Load streak & XP from localStorage ─── */
  function loadGamification(sessionId: string) {
    try {
      const streakData = localStorage.getItem(`${STREAK_STORAGE_KEY}_${sessionId}`);
      if (streakData) {
        const parsed = JSON.parse(streakData);
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (parsed.lastDate === today) {
          setStreak(parsed.count);
        } else if (parsed.lastDate === yesterday) {
          setStreak(parsed.count);
        } else {
          setStreak(0);
          localStorage.setItem(`${STREAK_STORAGE_KEY}_${sessionId}`, JSON.stringify({ count: 0, lastDate: today }));
        }
      }
      const xpData = localStorage.getItem(`${XP_STORAGE_KEY}_${sessionId}`);
      if (xpData) setXp(parseInt(xpData, 10) || 0);
    } catch { /* ignore */ }
  }

  function incrementStreak(sessionId: string) {
    try {
      const today = new Date().toDateString();
      const streakData = localStorage.getItem(`${STREAK_STORAGE_KEY}_${sessionId}`);
      let count = 1;
      if (streakData) {
        const parsed = JSON.parse(streakData);
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (parsed.lastDate === today) return; // Already counted today
        if (parsed.lastDate === yesterday) count = parsed.count + 1;
      }
      localStorage.setItem(`${STREAK_STORAGE_KEY}_${sessionId}`, JSON.stringify({ count, lastDate: today }));
      setStreak(count);
    } catch { /* ignore */ }
  }

  function addXp(sessionId: string, amount: number) {
    setXp(prev => {
      const next = prev + amount;
      try { localStorage.setItem(`${XP_STORAGE_KEY}_${sessionId}`, String(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const loadTutor = useCallback(async (parentId: string) => {
    try {
      const res = await fetch(`/api/student/tutor?parentId=${encodeURIComponent(parentId)}`);
      const data = await res.json();
      if (data.tutor?.name) setTutorName(data.tutor.name);
    } catch { /* ignore */ }
  }, []);

  const loadDocuments = useCallback(async (parentId: string) => {
    try {
      const res = await fetch(`/api/student/homework?parentId=${parentId}`);
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
    void loadDocuments(kidSession.parent_id);
    void loadSessions(kidSession.id);
    void loadTutor(kidSession.parent_id);
    loadGamification(kidSession.id);
    try {
      const raw = localStorage.getItem(`${TODO_STORAGE_KEY}_${kidSession.id}`);
      if (raw) setTodos(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [mounted, kidSession, loadDocuments, loadSessions, loadTutor, router]);

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

    // Award XP for correct answers
    if (isCorrect) addXp(kidSession.id, 10);

    const nextIdx = quizData.current + 1;
    if (nextIdx >= quizData.questions.length) {
      setQuizData({ ...quizData, answers: newAnswers, done: true });
      // Trigger confetti
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1800);
      // Increment streak on quiz completion
      incrementStreak(kidSession.id);
      addXp(kidSession.id, 25);
    } else {
      setQuizData({ ...quizData, current: nextIdx, answers: newAnswers });
    }
  }

  function startTutorSession(documentId?: string) {
    if (!kidSession) return;
    // Increment streak when starting a session
    incrementStreak(kidSession.id);
    addXp(kidSession.id, 25);
    const params = new URLSearchParams({
      kidSessionId: kidSession.id,
      parentId: kidSession.parent_id,
    });
    if (documentId) {
      params.set("documentId", documentId);
      router.push(`/lesson?${params.toString()}`);
    } else {
      router.push(`/session/kid?${params.toString()}`);
    }
  }

  if (!kidSession) {
    return (
      <div className="vtx-auth-page">
        <p className="vtx-kid-subtitle" style={{ margin: 0 }}>Loading…</p>
      </div>
    );
  }

  const { greeting, emoji, motivational } = getGreetingData();
  const childName = kidSession.child_name?.trim() || "there";
  const dailyChallenge = DAILY_CHALLENGES[Math.floor(Date.now() / 86400000) % DAILY_CHALLENGES.length];

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
    { id: "study", label: "Study", icon: <MessageCircle size={18} /> },
    { id: "home", label: "Home", icon: <Home size={18} /> },
    { id: "profile", label: "Profile", icon: <User size={18} /> },
  ];

  return (
    <div className="vtx-kid-page vtx-kid-ui flex h-screen flex-col overflow-hidden">
      <header className="vtx-kid-header">
        <div className="vtx-kid-logo">Vertex</div>
      </header>

      {/* Confetti overlay */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            className="vtx-kid-confetti-container"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {confettiPieces.map((p) => (
              <div
                key={p.id}
                className="vtx-kid-confetti-piece"
                style={{
                  left: p.left,
                  top: p.top,
                  backgroundColor: p.color,
                  width: p.width,
                  height: p.height,
                  borderRadius: p.borderRadius,
                  animationDelay: p.delay,
                  // @ts-expect-error CSS custom properties
                  "--drift-x": p.driftX,
                  "--drift-y": p.driftY,
                  "--drift-r": p.driftR,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <ScrollArea className="kid-dashboard-scroll flex-1 [&_[data-slot=scroll-area-scrollbar]]:hidden">
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
                    <span className="vtx-kid-greeting-emoji">{emoji}</span>
                    {greeting}, <em>{childName}</em>.
                  </motion.h1>
                  <motion.p className="vtx-kid-motivational" variants={stagger} initial="hidden" animate="show" custom={2}>
                    {motivational}
                  </motion.p>

                  {/* Streak & XP Badges */}
                  <motion.div className="vtx-kid-badges-row" variants={stagger} initial="hidden" animate="show" custom={2.5}>
                    <div className="vtx-kid-badge">
                      <span className="vtx-kid-badge-icon vtx-kid-flame-pulse">🔥</span>
                      <span className="vtx-kid-badge-value">{streak}</span>
                      <span className="vtx-kid-badge-label">day streak</span>
                    </div>
                    <div className="vtx-kid-badge">
                      <span className="vtx-kid-badge-icon"><Zap size={16} style={{ color: "#f59e0b" }} /></span>
                      <span className="vtx-kid-badge-value">{xp}</span>
                      <span className="vtx-kid-badge-label">XP</span>
                    </div>
                  </motion.div>

                  <motion.button type="button" className="vtx-kid-cta" onClick={() => startTutorSession()} variants={stagger} initial="hidden" animate="show" custom={3}>
                    <div className="vtx-kid-cta-icon"><MessageCircle size={20} style={{ color: "var(--vtx-pink, #c8416a)" }} /></div>
                    <div className="vtx-kid-cta-text">
                      <div className="vtx-kid-cta-title">Study with tutor</div>
                      <div className="vtx-kid-cta-desc">Practice math with your tutor.</div>
                    </div>
                    <ChevronRight size={18} style={{ color: "var(--vtx-muted, #8a7f6e)" }} />
                  </motion.button>

                  {/* Daily Challenge Card */}
                  <motion.div className="vtx-kid-daily-challenge" variants={stagger} initial="hidden" animate="show" custom={4}>
                    <div className="vtx-kid-challenge-icon">
                      <Sparkles size={22} style={{ color: "var(--vtx-pink, #c8416a)" }} />
                    </div>
                    <div>
                      <div className="vtx-kid-challenge-label">Daily Challenge</div>
                      <div className="vtx-kid-challenge-text">{dailyChallenge}</div>
                    </div>
                  </motion.div>

                  <motion.div className="vtx-kid-actions-label" variants={stagger} initial="hidden" animate="show" custom={5}>
                    What would you like to do?
                  </motion.div>

                  <div className="vtx-kid-action-grid">
                  <motion.button type="button" className="vtx-kid-action-card" onClick={() => setHomeView("homework")} variants={stagger} initial="hidden" animate="show" custom={6}>
                    <span className="vtx-kid-action-arrow"><ArrowRight size={16} /></span>
                    <div className="vtx-kid-action-icon"><Upload size={22} style={{ color: "var(--vtx-pink, #c8416a)" }} /></div>
                    <div className="vtx-kid-action-title">Upload homework</div>
                    <div className="vtx-kid-action-desc">Add a PDF to study from</div>
                    {documents.length > 0 && (
                      <div className="vtx-kid-action-badge">{documents.length} file{documents.length !== 1 ? "s" : ""}</div>
                    )}
                  </motion.button>
                  <motion.button type="button" className={cn("vtx-kid-action-card", quizLoading && "opacity-60")} onClick={startQuiz} disabled={quizLoading} variants={stagger} initial="hidden" animate="show" custom={7}>
                    <span className="vtx-kid-action-arrow"><ArrowRight size={16} /></span>
                    <div className="vtx-kid-action-icon"><Sparkles size={22} style={{ color: "var(--vtx-pink, #c8416a)" }} /></div>
                    <div className="vtx-kid-action-title">{quizLoading ? "Loading…" : "Take a quiz"}</div>
                    <div className="vtx-kid-action-desc">Practice with math questions</div>
                    <div className="vtx-kid-action-badge vtx-kid-action-badge-new">+10 XP</div>
                  </motion.button>
                  <motion.button type="button" className="vtx-kid-action-card" onClick={() => setActiveTab("study")} variants={stagger} initial="hidden" animate="show" custom={8}>
                    <span className="vtx-kid-action-arrow"><ArrowRight size={16} /></span>
                    <div className="vtx-kid-action-icon"><MessageCircle size={22} style={{ color: "var(--vtx-pink, #c8416a)" }} /></div>
                    <div className="vtx-kid-action-title">Start studying</div>
                    <div className="vtx-kid-action-desc">Get help with math</div>
                    <div className="vtx-kid-action-badge vtx-kid-action-badge-new">+25 XP</div>
                  </motion.button>
                  </div>

                </div>

                <div className="vtx-kid-home-center">
                  <motion.div className="vtx-kid-agent-panel" variants={stagger} initial="hidden" animate="show" custom={5}>
                    <span className="vtx-kid-agent-label">Your tutor</span>
                    <div className="vtx-kid-agent-avatar-wrap">
                      <ParentAvatar
                        parentName={tutorName || "Your tutor"}
                        focusLevel="high"
                        isSpeaking={false}
                      />
                    </div>
                    <p className="vtx-kid-agent-desc">
                      Ready to help you with math, {childName}. Start a session above to chat.
                    </p>
                  </motion.div>
                </div>

                <aside className="vtx-kid-home-right">
                  <div className="vtx-kid-sidebar-block">
                    <div className="vtx-kid-sidebar-heading">
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
                  </div>

                  <div className="vtx-kid-sidebar-block">
                    <div className="vtx-kid-sidebar-heading">
                      <BarChart3 size={16} style={{ color: "#8b5cf6" }} />
                      <span>How you&apos;re doing</span>
                    </div>

                    {/* Focus progress ring */}
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
                  </div>

                  <div className="vtx-kid-sidebar-block">
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
                  </div>
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
                <p className="vtx-kid-subtitle">Upload PDFs here. Your tutor can reference them during study sessions.</p>

                <label className="vtx-kid-upload-area">
                  <div className="vtx-kid-upload-icon"><Upload size={24} style={{ color: "var(--vtx-pink, #c8416a)" }} /></div>
                  <div className="vtx-kid-upload-title">{uploading ? "Uploading…" : "Drop your homework PDF here"}</div>
                  <div className="vtx-kid-upload-hint">or tap to choose a file</div>
                  <input type="file" accept=".pdf" style={{ display: "none" }} onChange={handleHomeworkUpload} disabled={uploading} />
                </label>

                {documents.length === 0 ? (
                  <div className="vtx-kid-empty">
                    <BookOpen size={36} style={{ color: "rgba(200,65,106,0.35)" }} />
                    <div className="vtx-kid-empty-title">No homework yet</div>
                    <p>When you upload a PDF, it will show up here. You can then start a study session and ask your tutor about it.</p>
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
                            <div className="vtx-kid-doc-date">{new Date(doc.uploaded_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <button type="button" className="vtx-kid-doc-btn" onClick={() => startTutorSession(doc.id)}>
                          <Play size={12} /> Study
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
                    <h2 className="vtx-kid-quiz-title">Quiz complete, {childName}! 🎉</h2>
                    <div className="vtx-kid-quiz-result">
                      {quizData.answers.filter((a) => a.correct).length}/{quizData.questions.length}
                    </div>
                    <p className="vtx-kid-quiz-desc">
                      {quizData.answers.filter((a) => a.correct).length}/{quizData.questions.length} correct — you earned{" "}
                      <strong style={{ color: "var(--vtx-pink)" }}>
                        {quizData.answers.filter((a) => a.correct).length * 10 + 25} XP
                      </strong>
                      !
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

            {activeTab === "study" && (
              <motion.div key="study" {...tabTransition}>
                <span className="vtx-kid-section-num">Study</span>
                <h2 className="vtx-kid-section-title">Start <em>Studying</em>, {childName}</h2>
                <p className="vtx-kid-subtitle">Your tutor can help you with math problems, explain concepts, give hints, and practice with you.</p>

                <button type="button" className="vtx-kid-cta" onClick={() => startTutorSession()}>
                  <div className="vtx-kid-cta-icon"><MessageCircle size={20} style={{ color: "var(--vtx-pink, #c8416a)" }} /></div>
                  <div className="vtx-kid-cta-text">
                    <div className="vtx-kid-cta-title">Start chatting</div>
                    <div className="vtx-kid-cta-desc">Open a new study session</div>
                  </div>
                  <ChevronRight size={18} style={{ color: "var(--vtx-muted, #8a7f6e)" }} />
                </button>

                {documents.length > 0 ? (
                  <div style={{ marginTop: 40 }}>
                    <div className="vtx-kid-doc-list-label">Or study with a homework file</div>
                    {documents.map((doc) => (
                      <button key={doc.id} type="button" className="vtx-kid-cta" onClick={() => startTutorSession(doc.id)} style={{ marginTop: 10 }}>
                        <div className="vtx-kid-doc-icon"><FileText size={18} style={{ color: "var(--vtx-pink, #c8416a)" }} /></div>
                        <div className="vtx-kid-cta-text"><div className="vtx-kid-cta-title">{doc.file_name}</div></div>
                        <ChevronRight size={18} style={{ color: "var(--vtx-muted, #8a7f6e)" }} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="vtx-kid-empty" style={{ marginTop: 40 }}>
                    <p>Upload homework on Home to study with a specific file. Or start chatting above for general help!</p>
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
                      <span className="vtx-kid-profile-stat-icon">🔥</span>
                      <span className="vtx-kid-profile-stat-value">{streak}</span>
                      <span className="vtx-kid-profile-stat-label">Streak</span>
                    </div>
                    <div className="vtx-kid-profile-stat">
                      <span className="vtx-kid-profile-stat-icon">⚡</span>
                      <span className="vtx-kid-profile-stat-value">{xp}</span>
                      <span className="vtx-kid-profile-stat-label">XP</span>
                    </div>
                    <div className="vtx-kid-profile-stat">
                      <span className="vtx-kid-profile-stat-icon">📚</span>
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
      </ScrollArea>

      {/* Bottom nav with active pill */}
      <nav className="vtx-kid-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`vtx-kid-nav-item${activeTab === item.id ? " active" : ""}`}
            onClick={() => {
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

function getGreetingData(): { greeting: string; emoji: string; motivational: string } {
  const hour = new Date().getHours();
  const motivationals = [
    "Ready to learn something new today?",
    "Keep up the amazing work!",
    "You're doing great — let's keep going!",
    "Every problem you solve makes you stronger!",
    "Today is a great day to grow your brain!",
  ];
  const motivational = motivationals[Math.floor(Date.now() / 86400000) % motivationals.length];

  if (hour < 12) return { greeting: "Good morning", emoji: "☀️", motivational };
  if (hour < 17) return { greeting: "Good afternoon", emoji: "🌤️", motivational };
  return { greeting: "Good evening", emoji: "🌙", motivational };
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
