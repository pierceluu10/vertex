"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, BookOpen, FileText, Settings, Copy, Plus,
  LogOut, ChevronRight, Users, Eye, X, TrendingUp, Activity,
  Brain, Sparkles, CheckCircle, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  Parent, AccessCode, TutoringSession, UploadedDocument,
  FocusEvent,
} from "@/types";
import { Card } from "@/components/ui/card";
import { VertexLogo } from "@/components/vertex/vertex-logo";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import "@/styles/vertex.css";

type Tab = "overview" | "progress" | "homework" | "analytics" | "insights" | "settings";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: "easeOut" as const },
  }),
};

const tabMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export default function ParentDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [parent, setParent] = useState<Parent | null>(null);
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [sessions, setSessions] = useState<TutoringSession[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [focusEvents, setFocusEvents] = useState<FocusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [codeForm, setCodeForm] = useState({
    childName: "", childAge: "", gradeLevel: "", learningGoals: "",
    mathTopics: [] as string[], learningPace: "medium" as "slow" | "medium" | "fast",
  });
  const [settingsAccountEditing, setSettingsAccountEditing] = useState(false);
  const [settingsAccountForm, setSettingsAccountForm] = useState({ name: "", childName: "", gradeLevel: "" });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsLearningTopics, setSettingsLearningTopics] = useState<string[]>([]);
  const [settingsLearningPace, setSettingsLearningPace] = useState<"slow" | "medium" | "fast">("medium");

  // Insights state
  type InsightSession = TutoringSession & { focus_timeline?: { timestamp: number; score: number }[]; distraction_events?: { timestamp: number; type: string; focusScore: number }[]; focus_score?: number; study_duration?: number };
  const [insightSessions, setInsightSessions] = useState<InsightSession[]>([]);
  const [insightMastery, setInsightMastery] = useState<{ topic: string; adjustedConfidence: number; daysSinceActive: number; isStale: boolean; last_active_at: string }[]>([]);
  const [selectedInsightSession, setSelectedInsightSession] = useState<string | null>(null);
  const [insightsLoaded, setInsightsLoaded] = useState(false);
  const [generatingLesson, setGeneratingLesson] = useState<string | null>(null);

  const topicOptions = [
    "Addition", "Subtraction", "Multiplication", "Division",
    "Fractions", "Decimals", "Geometry", "Algebra",
    "Word Problems", "Measurement", "Time", "Money",
  ];

  function toggleCodeFormTopic(topic: string) {
    setCodeForm((prev) => ({
      ...prev,
      mathTopics: prev.mathTopics.includes(topic)
        ? prev.mathTopics.filter((t) => t !== topic)
        : [...prev.mathTopics, topic],
    }));
  }

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [parentRes, sessionsRes, docsRes] = await Promise.all([
      supabase.from("parents").select("*").eq("id", user.id).single(),
      supabase.from("tutoring_sessions").select("*").order("started_at", { ascending: false }).limit(50),
      supabase.from("uploaded_documents").select("*").eq("parent_id", user.id).order("uploaded_at", { ascending: false }),
    ]);

    if (parentRes.data) setParent(parentRes.data);
    if (sessionsRes.data) setSessions(sessionsRes.data);
    if (docsRes.data) setDocuments(docsRes.data);

    try {
      const codesRes = await fetch("/api/access-code");
      const codesData = await codesRes.json();
      if (codesData.codes) setAccessCodes(codesData.codes);
    } catch { /* ignore */ }

    if (sessionsRes.data?.length) {
      const recentSessionIds = sessionsRes.data.slice(0, 5).map((s: TutoringSession) => s.id);
      const { data: events } = await supabase
        .from("focus_events").select("*")
        .in("session_id", recentSessionIds)
        .order("created_at", { ascending: false });
      if (events) setFocusEvents(events);
    }

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (activeTab === "settings" && parent) {
      setSettingsLearningTopics(parent.math_topics || []);
      setSettingsLearningPace(parent.learning_pace || "medium");
    }
  }, [activeTab, parent]);

  async function updateParentProfile(payload: Record<string, unknown>) {
    setSettingsSaving(true);
    try {
      const res = await fetch("/api/parent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data) { setParent(data); return true; }
      return false;
    } catch { return false; }
    finally { setSettingsSaving(false); }
  }

  function startEditAccount() {
    if (parent) {
      setSettingsAccountForm({
        name: parent.name || "", childName: parent.child_name || "",
        gradeLevel: parent.grade_level || "",
      });
      setSettingsAccountEditing(true);
    }
  }

  async function saveAccountSettings(e: React.FormEvent) {
    e.preventDefault();
    const ok = await updateParentProfile({
      name: settingsAccountForm.name.trim(),
      child_name: settingsAccountForm.childName.trim() || null,
      grade_level: settingsAccountForm.gradeLevel.trim() || null,
    });
    if (ok) setSettingsAccountEditing(false);
  }

  function toggleSettingsTopic(topic: string) {
    setSettingsLearningTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  }

  async function saveLearningSettings() {
    await updateParentProfile({ math_topics: settingsLearningTopics, learning_pace: settingsLearningPace });
  }

  async function toggleNotificationRealtime() {
    await updateParentProfile({ notification_realtime: !parent?.notification_realtime });
  }
  async function toggleNotificationDaily() {
    await updateParentProfile({ notification_daily: !parent?.notification_daily });
  }

  async function submitCodeForm(e: React.FormEvent) {
    e.preventDefault();
    setCodeError(null);
    const age = parseInt(codeForm.childAge, 10);
    if (!codeForm.childName.trim()) { setCodeError("Child's name is required."); return; }
    if (!codeForm.childAge || isNaN(age) || age < 3 || age > 18) { setCodeError("Age must be between 3 and 18."); return; }
    if (!codeForm.gradeLevel.trim()) { setCodeError("Grade level is required."); return; }
    setGeneratingCode(true);
    try {
      const res = await fetch("/api/access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: codeForm.childName.trim(), childAge: age,
          gradeLevel: codeForm.gradeLevel.trim(),
          mathTopics: codeForm.mathTopics, learningGoals: codeForm.learningGoals.trim() || undefined, learningPace: codeForm.learningPace,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCodeForm(false);
        setCodeForm({ childName: "", childAge: "", gradeLevel: "", learningGoals: "", mathTopics: [], learningPace: "medium" });
        await loadData();
      } else {
        setCodeError(data.error || "Failed to create access code");
      }
    } catch {
      setCodeError("Could not create access code. Please try again.");
    }
    setGeneratingCode(false);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  async function deactivateCode(codeId: string) {
    await fetch("/api/access-code", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codeId }),
    });
    await loadData();
  }

  async function createLesson(documentId: string) {
    setGeneratingLesson(documentId);
    try {
      const res = await fetch("/api/documents/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch { /* ignore */ }
    setGeneratingLesson(null);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const todaySessions = sessions.filter((s) => {
    const d = new Date(s.started_at);
    return d.toDateString() === new Date().toDateString();
  });
  const avgFocus = completedSessions.length
    ? Math.round(completedSessions.reduce((sum, s) => sum + (s.focus_score_avg || 0), 0) / completedSessions.length)
    : 0;

  const sidebarItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart3 size={18} /> },
    { id: "progress", label: "Progress", icon: <ChevronRight size={18} /> },
    { id: "homework", label: "Homework", icon: <BookOpen size={18} /> },
    { id: "analytics", label: "Analytics", icon: <TrendingUp size={18} /> },
    { id: "insights", label: "Insights", icon: <Brain size={18} /> },
    { id: "settings", label: "Settings", icon: <Settings size={18} /> },
  ];

  // Load insights data when tab is selected
  useEffect(() => {
    if (activeTab !== "insights" || insightsLoaded) return;
    async function loadInsights() {
      try {
        const [sessRes, mastRes] = await Promise.all([
          fetch("/api/insights/sessions").then(r => r.json()),
          fetch("/api/insights/mastery").then(r => r.json()),
        ]);
        if (sessRes.sessions) {
          setInsightSessions(sessRes.sessions);
          if (sessRes.sessions.length > 0) setSelectedInsightSession(sessRes.sessions[0].id);
        }
        if (mastRes.topics) setInsightMastery(mastRes.topics);
        setInsightsLoaded(true);
      } catch { /* ignore */ }
    }
    loadInsights();
  }, [activeTab, insightsLoaded]);

  if (loading) {
    return (
      <div className="vtx-parent-loading">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          Loading...
        </motion.p>
      </div>
    );
  }

  return (
    <div className="vtx-parent-page">
      {/* Sidebar */}
      <aside className="vtx-parent-sidebar">
        <div className="vtx-parent-sidebar-header">
          <VertexLogo href="/" height={48} className="vtx-parent-sidebar-logo" />
          <div className="vtx-parent-sidebar-name">{parent?.name || "Parent"}</div>
        </div>
        <nav className="vtx-parent-sidebar-nav">
          {sidebarItems.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`vtx-parent-sidebar-item${activeTab === item.id ? " active" : ""}`}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
            >
              {item.icon}
              <span>{item.label}</span>
            </motion.button>
          ))}
        </nav>
        <div className="vtx-parent-sidebar-footer">
          <motion.button onClick={handleSignOut} className="vtx-parent-btn-outline vtx-parent-btn-full" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
            <LogOut size={14} /> Sign out
          </motion.button>
        </div>
      </aside>

      {/* Main content */}
      <main className="vtx-parent-main">
        <AnimatePresence mode="wait">
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <motion.div key="overview" {...tabMotion}>
              <motion.span className="vtx-parent-section-label" variants={fadeUp} initial="hidden" animate="show" custom={0}>
                Overview
              </motion.span>
              <motion.h1 className="vtx-parent-heading" variants={fadeUp} initial="hidden" animate="show" custom={1}>
                Welcome back, <em>{parent?.name?.split(" ")[0]}</em>
              </motion.h1>
              <motion.p className="vtx-parent-subheading" variants={fadeUp} initial="hidden" animate="show" custom={2}>
                Here&apos;s how {parent?.child_name || "your child"} is doing.
              </motion.p>

              <div className="vtx-parent-stat-grid">
                {[
                  { label: "Study today", value: todaySessions.length, unit: "sessions" },
                  { label: "Avg focus", value: `${avgFocus}%`, unit: "across sessions" },
                  { label: "Homework", value: documents.length, unit: "uploaded" },
                  { label: "Distractions", value: focusEvents.length, unit: "events logged" },
                ].map((stat, i) => (
                  <motion.div key={stat.label} className="vtx-parent-stat-card" variants={fadeUp} initial="hidden" animate="show" custom={i + 3}>
                    <div className="vtx-parent-stat-label">{stat.label}</div>
                    <div className="vtx-parent-stat-value">{stat.value}</div>
                    <div className="vtx-parent-stat-unit">{stat.unit}</div>
                  </motion.div>
                ))}
              </div>

              {/* Access Codes */}
              <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={7}>
                <div className="vtx-parent-card-header">
                  <div className="vtx-parent-card-header-left">
                    <Users size={18} style={{ color: "#c8416a" }} />
                    <h2 className="vtx-parent-card-title">Access Codes</h2>
                  </div>
                  {!showCodeForm && (
                    <motion.button onClick={() => { setShowCodeForm(true); setCodeError(null); }} className="vtx-parent-btn" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                      <Plus size={14} /> New Code
                    </motion.button>
                  )}
                </div>

                <AnimatePresence>
                  {showCodeForm && (
                    <motion.form onSubmit={submitCodeForm} className="vtx-parent-code-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                      <p className="vtx-parent-muted-text">Each access code is unique to one child. Fill out name, age, grade, struggles, and goals so the tutor can personalize for them.</p>
                      <div className="vtx-parent-form-grid">
                        <div>
                          <label className="vtx-parent-label">Child&apos;s name <span className="vtx-parent-required">*</span></label>
                          <input type="text" placeholder="e.g. Alex" value={codeForm.childName} onChange={(e) => setCodeForm((p) => ({ ...p, childName: e.target.value }))} required className="vtx-parent-input" />
                        </div>
                        <div>
                          <label className="vtx-parent-label">Age (3–18) <span className="vtx-parent-required">*</span></label>
                          <input type="number" min={3} max={18} placeholder="e.g. 8" value={codeForm.childAge} onChange={(e) => setCodeForm((p) => ({ ...p, childAge: e.target.value }))} required className="vtx-parent-input" />
                        </div>
                      </div>
                      <div>
                        <label className="vtx-parent-label">Grade level <span className="vtx-parent-required">*</span></label>
                        <input type="text" placeholder="e.g. 3rd grade" value={codeForm.gradeLevel} onChange={(e) => setCodeForm((p) => ({ ...p, gradeLevel: e.target.value }))} required className="vtx-parent-input" />
                      </div>
                      <div>
                        <label className="vtx-parent-label">Math topics they struggle with</label>
                        <div className="vtx-parent-topic-chips">
                          {topicOptions.map((topic) => (
                            <button key={topic} type="button" onClick={() => toggleCodeFormTopic(topic)} className={`vtx-parent-chip${codeForm.mathTopics.includes(topic) ? " active" : ""}`}>
                              {topic}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="vtx-parent-label">Goals for this child</label>
                        <textarea placeholder="e.g. Get confident with fractions, finish homework without tears, prepare for the end-of-year test" value={codeForm.learningGoals} onChange={(e) => setCodeForm((p) => ({ ...p, learningGoals: e.target.value }))} className="vtx-parent-input" rows={3} style={{ resize: "vertical", minHeight: 72 }} />
                      </div>
                      <div>
                        <label className="vtx-parent-label">Learning pace</label>
                        <div className="vtx-parent-pace-btns">
                          {(["slow", "medium", "fast"] as const).map((pace) => (
                            <button key={pace} type="button" onClick={() => setCodeForm((p) => ({ ...p, learningPace: pace }))} className={`vtx-parent-chip${codeForm.learningPace === pace ? " active" : ""}`}>
                              {pace === "slow" ? "Slow & steady" : pace === "medium" ? "Balanced" : "Quick"}
                            </button>
                          ))}
                        </div>
                      </div>
                      {codeError && <p className="vtx-parent-error">{codeError}</p>}
                      <div className="vtx-parent-btn-row">
                        <button type="submit" disabled={generatingCode} className="vtx-parent-btn">
                          {generatingCode ? "Creating..." : "Create access code"}
                        </button>
                        <button type="button" onClick={() => { setShowCodeForm(false); setCodeError(null); }} className="vtx-parent-btn-outline">Cancel</button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {codeError && !showCodeForm && <p className="vtx-parent-error">{codeError}</p>}

                {accessCodes.filter((c) => c.is_active).length === 0 && !showCodeForm ? (
                  <p className="vtx-parent-muted-text">No active codes. Create one for your child to start learning.</p>
                ) : !showCodeForm ? (
                  <div className="vtx-parent-code-list">
                    {accessCodes.filter((c) => c.is_active).map((ac, i) => (
                      <motion.div key={ac.id} className="vtx-parent-code-item" variants={fadeUp} initial="hidden" animate="show" custom={i}>
                        <div className="vtx-parent-code-left">
                          <span className="vtx-parent-code-value">{ac.code}</span>
                          <span className="vtx-parent-code-meta">
                            {ac.child_name || "Unnamed"}
                            {ac.child_age != null && `, age ${ac.child_age}`}
                            {ac.grade_level && ` · ${ac.grade_level}`}
                          </span>
                        </div>
                        <div className="vtx-parent-code-actions">
                          <motion.button type="button" onClick={() => copyCode(ac.code)} className="vtx-parent-btn-outline" whileTap={{ scale: 0.95 }}>
                            <Copy size={12} /> {copiedCode === ac.code ? "Copied!" : "Copy"}
                          </motion.button>
                          <motion.button type="button" onClick={() => deactivateCode(ac.id)} className="vtx-parent-btn-outline vtx-parent-btn-danger" whileTap={{ scale: 0.95 }}>
                            <X size={12} />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : null}
              </motion.div>

              {/* Recent Sessions */}
              {sessions.length > 0 && (
                <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={8}>
                  <h2 className="vtx-parent-card-title" style={{ marginBottom: 16 }}>Recent Sessions</h2>
                  <div className="vtx-parent-session-list">
                    {sessions.slice(0, 5).map((session, i) => (
                      <motion.div key={session.id} className="vtx-parent-session-item" variants={fadeUp} initial="hidden" animate="show" custom={i}>
                        <div className="vtx-parent-session-left">
                          <div className={`vtx-parent-session-dot${session.status === "active" ? " live" : ""}`} />
                          <div>
                            <div className="vtx-parent-session-status">{session.status === "active" ? "In Progress" : "Completed"}</div>
                            <div className="vtx-parent-session-date">
                              {new Date(session.started_at).toLocaleDateString()} at {new Date(session.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                        {session.focus_score_avg != null && (
                          <span className={`vtx-parent-focus-badge${session.focus_score_avg >= 75 ? " good" : session.focus_score_avg >= 50 ? " ok" : " low"}`}>
                            {Math.round(session.focus_score_avg)}% focus
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* PROGRESS */}
          {activeTab === "progress" && (
            <motion.div key="progress" {...tabMotion}>
              <span className="vtx-parent-section-label">Progress</span>
              <h1 className="vtx-parent-heading">Session <em>History</em></h1>
              <p className="vtx-parent-subheading">Completed sessions and focus scores.</p>

              {completedSessions.length === 0 ? (
                <div className="vtx-parent-card">
                  <p className="vtx-parent-muted-text">No completed sessions yet. They&apos;ll appear here once your child starts studying.</p>
                </div>
              ) : (
                <div className="vtx-parent-progress-list">
                  {completedSessions.map((session, i) => (
                    <motion.div key={session.id} className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={i}>
                      <div className="vtx-parent-progress-row">
                        <div>
                          <div className="vtx-parent-progress-date">
                            {new Date(session.started_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                          </div>
                          <div className="vtx-parent-progress-duration">
                            {session.ended_at ? `${Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000)} min` : "—"}
                          </div>
                        </div>
                        <div className="vtx-parent-progress-metrics">
                          <div className="vtx-parent-progress-metric">
                            <div className="vtx-parent-stat-label">Focus</div>
                            <div className={`vtx-parent-progress-focus${(session.focus_score_avg || 0) >= 75 ? " good" : " low"}`}>
                              {session.focus_score_avg != null ? `${Math.round(session.focus_score_avg)}%` : "—"}
                            </div>
                          </div>
                          <div className="vtx-parent-progress-metric">
                            <div className="vtx-parent-stat-label">Status</div>
                            <div className="vtx-parent-progress-status">{session.status}</div>
                          </div>
                        </div>
                      </div>
                      {session.session_summary && (
                        <p className="vtx-parent-progress-summary">{session.session_summary}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* HOMEWORK */}
          {activeTab === "homework" && (
            <motion.div key="homework" {...tabMotion}>
              <span className="vtx-parent-section-label">Homework</span>
              <h1 className="vtx-parent-heading">Uploaded <em>Files</em></h1>
              <p className="vtx-parent-subheading">PDFs your child uploaded for study sessions.</p>

              <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={0}>
                <div className="vtx-parent-card-header-left" style={{ marginBottom: 16 }}>
                  <BookOpen size={18} style={{ color: "#c8416a" }} />
                  <h2 className="vtx-parent-card-title">Upload Homework</h2>
                </div>
                <label className="vtx-parent-upload-area">
                  <FileText size={16} style={{ color: "#c8416a" }} /> Choose File
                  <input type="file" style={{ display: "none" }} onChange={async (e) => {
                    if (!e.target.files?.[0]) return;
                    const formData = new FormData();
                    formData.append("file", e.target.files[0]);
                    await fetch("/api/upload", { method: "POST", body: formData });
                    await loadData();
                  }} />
                </label>
              </motion.div>

              {documents.length > 0 && (
                <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={1}>
                  <h2 className="vtx-parent-card-title" style={{ marginBottom: 16 }}>Uploaded Files</h2>
                  <div className="vtx-parent-doc-list">
                    {documents.map((doc, i) => (
                      <motion.div key={doc.id} className="vtx-parent-doc-item" variants={fadeUp} initial="hidden" animate="show" custom={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(26,22,14,.06)" }}>
                        <FileText size={18} style={{ color: "#c8416a", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="vtx-parent-doc-name">{doc.file_name}</div>
                          <div className="vtx-parent-doc-date">{new Date(doc.uploaded_at).toLocaleDateString()}</div>
                          {doc.extracted_text && (
                            <div style={{ fontSize: 11, color: "rgba(26,22,14,.4)", marginTop: 2 }}>
                              {doc.extracted_text.slice(0, 80)}…
                            </div>
                          )}
                        </div>
                        {doc.lesson_plan ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#4aaa6a", background: "rgba(74,170,106,.08)", padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                            <CheckCircle size={13} /> Lesson Ready
                          </span>
                        ) : (
                          <button
                            onClick={() => createLesson(doc.id)}
                            disabled={generatingLesson === doc.id}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              fontSize: 11, fontWeight: 600, color: "#fff",
                              background: generatingLesson === doc.id ? "rgba(200,65,106,.5)" : "#c8416a",
                              border: "none", padding: "6px 14px", borderRadius: 20,
                              cursor: generatingLesson === doc.id ? "wait" : "pointer",
                              whiteSpace: "nowrap", transition: "background .2s",
                            }}
                          >
                            {generatingLesson === doc.id ? (
                              <><Loader2 size={13} className="vtx-spin" /> Generating…</>
                            ) : (
                              <><Sparkles size={13} /> Create Lesson</>
                            )}
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ANALYTICS */}
          {activeTab === "analytics" && (
            <motion.div key="analytics" {...tabMotion}>
              <span className="vtx-parent-section-label">Analytics</span>
              <h1 className="vtx-parent-heading">Learning <em>Insights</em></h1>
              <p className="vtx-parent-subheading">
                How {parent?.child_name || "your child"} uses Vertex.
              </p>

              {sessions.length === 0 ? (
                <div className="vtx-parent-card">
                  <p className="vtx-parent-muted-text">No activity yet. Analytics will appear once study sessions begin.</p>
                </div>
              ) : (
                <>
                  <div className="vtx-parent-stat-grid">
                    {[
                      { label: "Total sessions", value: completedSessions.length, unit: "completed" },
                      { label: "Avg focus", value: `${avgFocus}%`, unit: "across sessions" },
                      { label: "Distraction events", value: focusEvents.length, unit: "logged" },
                      { label: "Study this week", value: sessions.filter((s) => { const d = new Date(s.started_at); const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); return d >= weekAgo; }).length, unit: "sessions" },
                    ].map((stat, i) => (
                      <motion.div key={stat.label} className="vtx-parent-stat-card" variants={fadeUp} initial="hidden" animate="show" custom={i}>
                        <div className="vtx-parent-stat-label">{stat.label}</div>
                        <div className="vtx-parent-stat-value">{stat.value}</div>
                        <div className="vtx-parent-stat-unit">{stat.unit}</div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Focus trend */}
                  <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={6}>
                    <h2 className="vtx-parent-card-title" style={{ marginBottom: 4 }}>Focus score trend</h2>
                    <p className="vtx-parent-muted-text" style={{ marginBottom: 16 }}>Average focus % for recent completed sessions</p>
                    <div className="vtx-parent-bar-chart" style={{ height: 120 }}>
                      {completedSessions.slice(0, 7).reverse().map((session, i) => {
                        const score = session.focus_score_avg ?? 0;
                        return (
                          <div key={session.id} className="vtx-parent-bar-col">
                            <motion.div
                              className={`vtx-parent-bar${score >= 75 ? " good" : score >= 50 ? " ok" : " low"}`}
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.min(100, score)}%` }}
                              transition={{ delay: i * 0.06, duration: 0.5, ease: "easeOut" }}
                              style={{ minHeight: score > 0 ? 16 : 4 }}
                            />
                            <span className="vtx-parent-bar-value" style={{ fontWeight: 500 }}>{Math.round(score)}%</span>
                            <span className="vtx-parent-bar-label">S{completedSessions.length - i}</span>
                          </div>
                        );
                      })}
                      {completedSessions.length === 0 && (
                        <span className="vtx-parent-muted-text">No completed sessions yet</span>
                      )}
                    </div>
                  </motion.div>

                  {/* Learning comprehension trend */}
                  <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={7}>
                    <h2 className="vtx-parent-card-title" style={{ marginBottom: 4 }}>Learning comprehension</h2>
                    <p className="vtx-parent-muted-text" style={{ marginBottom: 16 }}>Estimated comprehension based on focus and session duration</p>
                    <div className="vtx-parent-bar-chart" style={{ height: 120 }}>
                      {completedSessions.slice(0, 10).reverse().map((session, i) => {
                        const focus = session.focus_score_avg ?? 50;
                        const durationMin = session.ended_at
                          ? (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000
                          : 0;
                        const durationFactor = Math.min(1, durationMin / 30);
                        const comprehension = Math.round(focus * 0.6 + durationFactor * 100 * 0.4);
                        return (
                          <div key={session.id} className="vtx-parent-bar-col">
                            <motion.div
                              className={`vtx-parent-bar${comprehension >= 70 ? " good" : comprehension >= 45 ? " ok" : " low"}`}
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.min(100, comprehension)}%` }}
                              transition={{ delay: i * 0.06, duration: 0.5, ease: "easeOut" }}
                              style={{ minHeight: comprehension > 0 ? 16 : 4 }}
                            />
                            <span className="vtx-parent-bar-value" style={{ fontWeight: 500 }}>{comprehension}%</span>
                            <span className="vtx-parent-bar-label">S{completedSessions.length - i}</span>
                          </div>
                        );
                      })}
                      {completedSessions.length === 0 && (
                        <span className="vtx-parent-muted-text">No completed sessions yet</span>
                      )}
                    </div>
                  </motion.div>

                  {/* Distraction breakdown */}
                  {focusEvents.length > 0 && (
                    <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={7}>
                      <h2 className="vtx-parent-card-title" style={{ marginBottom: 16 }}>Distraction breakdown</h2>
                      <div className="vtx-parent-distraction-grid">
                        {["tab_blur", "inactive", "face_absent", "no_response"].map((eventType, i) => {
                          const count = focusEvents.filter((e) => e.event_type === eventType).length;
                          return (
                            <motion.div key={eventType} className="vtx-parent-distraction-card" variants={fadeUp} initial="hidden" animate="show" custom={i}>
                              <Activity size={16} style={{ color: "#c8416a" }} />
                              <div>
                                <div className="vtx-parent-distraction-type">{eventType.replace("_", " ")}</div>
                                <div className="vtx-parent-distraction-count">{count}</div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* INSIGHTS */}
          {activeTab === "insights" && (
            <motion.div key="insights" {...tabMotion}>
              <span className="vtx-parent-section-label">Insights</span>
              <h1 className="vtx-parent-heading">Attention <em>Engine</em></h1>
              <p className="vtx-parent-subheading">Deep dive into {parent?.child_name || "your child"}&apos;s focus, confidence, and mastery.</p>

              {insightSessions.length === 0 ? (
                <div className="vtx-parent-card">
                  <p className="vtx-parent-muted-text">No session data yet. Insights will appear once your child completes study sessions with the attention engine active.</p>
                </div>
              ) : (
                <>
                  {/* Session picker */}
                  <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={0}>
                    <h2 className="vtx-parent-card-title" style={{ marginBottom: 12 }}>Focus Timeline</h2>
                    <div style={{ marginBottom: 16 }}>
                      <select
                        value={selectedInsightSession || ""}
                        onChange={(e) => setSelectedInsightSession(e.target.value)}
                        className="vtx-parent-input"
                        style={{ maxWidth: 320 }}
                      >
                        {insightSessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {new Date(s.started_at).toLocaleDateString()} — {new Date(s.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {s.focus_score != null ? ` (${Math.round(s.focus_score as number)}% avg)` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Recharts Line Chart */}
                    {(() => {
                      const selected = insightSessions.find((s) => s.id === selectedInsightSession);
                      const timeline = (selected?.focus_timeline || []) as { timestamp: number; score: number }[];
                      if (timeline.length === 0) {
                        return <p className="vtx-parent-muted-text">No focus timeline data for this session.</p>;
                      }
                      const startTime = timeline[0].timestamp;
                      const chartData = timeline.map((entry) => ({
                        minute: Math.round((entry.timestamp - startTime) / 60000),
                        score: entry.score,
                      }));
                      return (
                        <div style={{ width: "100%", height: 220 }}>
                          <ResponsiveContainer>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                              <XAxis dataKey="minute" tick={{ fontSize: 11, fill: "#8a7f6e" }} label={{ value: "Minutes", position: "insideBottom", offset: -4, style: { fontSize: 11, fill: "#8a7f6e" } }} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#8a7f6e" }} />
                              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }} formatter={(value) => [`${value}%`, "Focus"]} />
                              <ReferenceLine y={80} stroke="#5a9e76" strokeDasharray="4 4" strokeOpacity={0.5} />
                              <ReferenceLine y={50} stroke="#c89020" strokeDasharray="4 4" strokeOpacity={0.5} />
                              <Line type="monotone" dataKey="score" stroke="#c8416a" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#c8416a" }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()}
                  </motion.div>

                  {/* Distraction Event Log */}
                  {(() => {
                    const selected = insightSessions.find((s) => s.id === selectedInsightSession);
                    const events = (selected?.distraction_events || []) as { timestamp: number; type: string; focusScore: number }[];
                    if (events.length === 0) return null;
                    return (
                      <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={1}>
                        <h2 className="vtx-parent-card-title" style={{ marginBottom: 12 }}>Distraction Events</h2>
                        <div style={{ maxHeight: 240, overflowY: "auto" }}>
                          {events.map((ev, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                              <span style={{ fontSize: 11, color: "#8a7f6e", width: 70 }}>
                                {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                              </span>
                              <span style={{
                                padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                                background: ev.type === "face_absent" ? "rgba(239,68,68,0.1)" : ev.type === "tab_switch" ? "rgba(245,158,11,0.1)" : "rgba(139,92,246,0.1)",
                                color: ev.type === "face_absent" ? "#ef4444" : ev.type === "tab_switch" ? "#f59e0b" : "#8b5cf6",
                              }}>
                                {ev.type.replace("_", " ")}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: ev.focusScore >= 50 ? "#5a9e76" : "#c8416a" }}>
                                {ev.focusScore}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })()}

                  {/* Content Confidence Breakdown */}
                  <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={2}>
                    <h2 className="vtx-parent-card-title" style={{ marginBottom: 16 }}>Content Confidence Breakdown</h2>
                    <p className="vtx-parent-muted-text" style={{ marginBottom: 16 }}>Components of the content confidence score</p>
                    {[
                      { label: "Quiz Accuracy", value: 78, color: "#5a9e76" },
                      { label: "Response Quality", value: 65, color: "#3b82f6" },
                      { label: "Hint Dependency", value: 85, color: "#8b5cf6" },
                      { label: "Repeat Questions", value: 90, color: "#06b6d4" },
                      { label: "Response Speed", value: 72, color: "#f59e0b" },
                    ].map((bar) => (
                      <div key={bar.label} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: "#5c5347" }}>{bar.label}</span>
                          <span style={{ fontWeight: 600, color: bar.color }}>{bar.value}%</span>
                        </div>
                        <div style={{ height: 8, background: "rgba(0,0,0,0.04)", borderRadius: 4, overflow: "hidden" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${bar.value}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            style={{ height: "100%", background: bar.color, borderRadius: 4 }}
                          />
                        </div>
                      </div>
                    ))}
                  </motion.div>

                  {/* Topic Mastery Map */}
                  {insightMastery.length > 0 && (
                    <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={3}>
                      <h2 className="vtx-parent-card-title" style={{ marginBottom: 16 }}>Topic Mastery</h2>
                      {insightMastery.map((t, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#1a1610" }}>{t.topic}</span>
                          <div style={{ width: 120, height: 6, background: "rgba(0,0,0,0.04)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{
                              width: `${t.adjustedConfidence}%`, height: "100%", borderRadius: 3,
                              background: t.adjustedConfidence >= 70 ? "#5a9e76" : t.adjustedConfidence >= 40 ? "#c89020" : "#c8416a",
                            }} />
                          </div>
                          <span style={{ width: 36, fontSize: 12, fontWeight: 600, textAlign: "right", color: t.adjustedConfidence >= 70 ? "#5a9e76" : t.adjustedConfidence >= 40 ? "#c89020" : "#c8416a" }}>
                            {t.adjustedConfidence}%
                          </span>
                          <span style={{ width: 70, fontSize: 10, color: "#8a7f6e", textAlign: "right" }}>
                            {t.last_active_at ? new Date(t.last_active_at).toLocaleDateString([], { month: "short", day: "numeric" }) : "—"}
                          </span>
                          {t.isStale && (
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(245,158,11,0.12)", color: "#c89020", fontWeight: 600 }}>
                              Stale
                            </span>
                          )}
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {/* Session Comparison Table */}
                  <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={4}>
                    <h2 className="vtx-parent-card-title" style={{ marginBottom: 16 }}>Session Comparison</h2>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            {["Date", "Avg Focus", "Duration", "Distractions", "Status"].map((h) => (
                              <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "#5c5347", fontSize: 11 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {insightSessions.slice(0, 5).map((s) => {
                            const distractionCount = Array.isArray(s.distraction_events) ? s.distraction_events.length : 0;
                            const durationMin = s.ended_at ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000) : 0;
                            const focus = typeof s.focus_score === "number" ? Math.round(s.focus_score) : (s.focus_score_avg ? Math.round(s.focus_score_avg) : 0);
                            return (
                              <tr key={s.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                                <td style={{ padding: "8px 10px", color: "#1a1610" }}>
                                  {new Date(s.started_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                                </td>
                                <td style={{ padding: "8px 10px" }}>
                                  <span style={{ fontWeight: 600, color: focus >= 80 ? "#5a9e76" : focus >= 50 ? "#c89020" : "#c8416a" }}>
                                    {focus}%
                                  </span>
                                </td>
                                <td style={{ padding: "8px 10px", color: "#5c5347" }}>{durationMin > 0 ? `${durationMin}m` : "—"}</td>
                                <td style={{ padding: "8px 10px", color: "#5c5347" }}>{distractionCount}</td>
                                <td style={{ padding: "8px 10px" }}>
                                  <span style={{
                                    fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                                    background: s.status === "completed" ? "rgba(90,158,118,0.1)" : "rgba(200,65,106,0.1)",
                                    color: s.status === "completed" ? "#5a9e76" : "#c8416a",
                                  }}>
                                    {s.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                </>
              )}
            </motion.div>
          )}

          {/* SETTINGS */}
          {activeTab === "settings" && (
            <motion.div key="settings" {...tabMotion}>
              <span className="vtx-parent-section-label">Settings</span>
              <h1 className="vtx-parent-heading">Your <em>Settings</em></h1>

              {/* Account */}
              <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={0}>
                <div className="vtx-parent-card-header">
                  <h2 className="vtx-parent-card-title">Account</h2>
                  {!settingsAccountEditing && (
                    <button type="button" onClick={startEditAccount} className="vtx-parent-btn-outline" disabled={settingsSaving}>Edit</button>
                  )}
                </div>
                {settingsAccountEditing ? (
                  <form onSubmit={saveAccountSettings}>
                    <div className="vtx-parent-form-grid">
                      <div>
                        <label className="vtx-parent-label">Name</label>
                        <input type="text" value={settingsAccountForm.name} onChange={(e) => setSettingsAccountForm((p) => ({ ...p, name: e.target.value }))} className="vtx-parent-input" />
                      </div>
                      <div>
                        <div className="vtx-parent-label">Email</div>
                        <div className="vtx-parent-static-value">{parent?.email}</div>
                        <div className="vtx-parent-muted-text" style={{ fontSize: 11 }}>Managed by your sign-in account</div>
                      </div>
                      <div>
                        <label className="vtx-parent-label">Child&apos;s Name</label>
                        <input type="text" placeholder="e.g. Alex" value={settingsAccountForm.childName} onChange={(e) => setSettingsAccountForm((p) => ({ ...p, childName: e.target.value }))} className="vtx-parent-input" />
                      </div>
                      <div>
                        <label className="vtx-parent-label">Grade Level</label>
                        <input type="text" placeholder="e.g. 3rd grade" value={settingsAccountForm.gradeLevel} onChange={(e) => setSettingsAccountForm((p) => ({ ...p, gradeLevel: e.target.value }))} className="vtx-parent-input" />
                      </div>
                    </div>
                    <div className="vtx-parent-btn-row">
                      <button type="submit" className="vtx-parent-btn" disabled={settingsSaving}>{settingsSaving ? "Saving..." : "Save"}</button>
                      <button type="button" onClick={() => setSettingsAccountEditing(false)} className="vtx-parent-btn-outline">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="vtx-parent-form-grid">
                    <div>
                      <div className="vtx-parent-label">Name</div>
                      <div className="vtx-parent-static-value">{parent?.name || "—"}</div>
                    </div>
                    <div>
                      <div className="vtx-parent-label">Email</div>
                      <div className="vtx-parent-static-value">{parent?.email || "—"}</div>
                    </div>
                    <div>
                      <div className="vtx-parent-label">Child&apos;s Name</div>
                      <div className="vtx-parent-static-value">{parent?.child_name || "—"}</div>
                    </div>
                    <div>
                      <div className="vtx-parent-label">Grade Level</div>
                      <div className="vtx-parent-static-value">{parent?.grade_level || "—"}</div>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Learning Configuration */}
              <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={1}>
                <h2 className="vtx-parent-card-title" style={{ marginBottom: 16 }}>Learning Configuration</h2>
                <div style={{ marginBottom: 16 }}>
                  <div className="vtx-parent-label">Math Topics</div>
                  <p className="vtx-parent-muted-text" style={{ marginBottom: 6 }}>Select topics your child should focus on</p>
                  <div className="vtx-parent-topic-chips">
                    {topicOptions.map((topic) => (
                      <button key={topic} type="button" onClick={() => toggleSettingsTopic(topic)} className={`vtx-parent-chip${settingsLearningTopics.includes(topic) ? " active" : ""}`}>
                        {topic}
                      </button>
                    ))}
                  </div>
                  {settingsLearningTopics.length === 0 && <span className="vtx-parent-muted-text" style={{ display: "block", marginTop: 6 }}>None selected</span>}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div className="vtx-parent-label">Learning Pace</div>
                  <div className="vtx-parent-pace-btns">
                    {(["slow", "medium", "fast"] as const).map((pace) => (
                      <button key={pace} type="button" onClick={() => setSettingsLearningPace(pace)} className={`vtx-parent-chip${settingsLearningPace === pace ? " active" : ""}`}>
                        {pace === "slow" ? "Slow & steady" : pace === "medium" ? "Medium" : "Fast"}
                      </button>
                    ))}
                  </div>
                </div>
                <motion.button type="button" onClick={saveLearningSettings} className="vtx-parent-btn" disabled={settingsSaving} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                  {settingsSaving ? "Saving..." : "Save learning config"}
                </motion.button>
              </motion.div>

              {/* Notifications */}
              <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={2}>
                <h2 className="vtx-parent-card-title" style={{ marginBottom: 16 }}>Notifications</h2>
                <div className="vtx-parent-notification-list">
                  <div className="vtx-parent-notification-row">
                    <div>
                      <div className="vtx-parent-notification-title">Real-time Focus Alerts</div>
                      <div className="vtx-parent-notification-desc">Email when distraction level hits high</div>
                    </div>
                    <button type="button" onClick={toggleNotificationRealtime} disabled={settingsSaving} className={`vtx-parent-toggle${parent?.notification_realtime ? " on" : ""}`} aria-label="Toggle real-time alerts">
                      <span className="vtx-parent-toggle-thumb" />
                    </button>
                  </div>
                  <div className="vtx-parent-notification-row">
                    <div>
                      <div className="vtx-parent-notification-title">Daily Summary</div>
                      <div className="vtx-parent-notification-desc">Daily email summary of all activity</div>
                    </div>
                    <button type="button" onClick={toggleNotificationDaily} disabled={settingsSaving} className={`vtx-parent-toggle${parent?.notification_daily ? " on" : ""}`} aria-label="Toggle daily summary">
                      <span className="vtx-parent-toggle-thumb" />
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Avatar */}
              <motion.div className="vtx-parent-card" variants={fadeUp} initial="hidden" animate="show" custom={3}>
                <h2 className="vtx-parent-card-title" style={{ marginBottom: 16 }}>Tutor Avatar</h2>
                <motion.button onClick={() => router.push("/parent")} className="vtx-parent-btn" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                  <Eye size={14} /> Manage Avatar
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
