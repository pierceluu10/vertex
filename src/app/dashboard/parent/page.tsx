"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, BookOpen, FileText, Settings, Copy, Plus,
  LogOut, ChevronRight, Users, Eye, X, TrendingUp, Activity,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  Parent, AccessCode, TutoringSession, UploadedDocument,
  FocusEvent,
} from "@/types";
import { Card } from "@/components/ui/card";
import { VertexLogo } from "@/components/vertex/vertex-logo";
import "@/styles/vertex.css";

type Tab = "overview" | "progress" | "homework" | "analytics" | "settings";

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
    { id: "settings", label: "Settings", icon: <Settings size={18} /> },
  ];

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
          <VertexLogo href="/" height={24} className="vtx-parent-sidebar-logo" />
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
                  <FileText size={16} style={{ color: "#c8416a" }} /> Choose PDF File
                  <input type="file" accept=".pdf" style={{ display: "none" }} onChange={async (e) => {
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
                  <h2 className="vtx-parent-card-title" style={{ marginBottom: 16 }}>Files</h2>
                  <div className="vtx-parent-doc-list">
                    {documents.map((doc, i) => (
                      <motion.div key={doc.id} className="vtx-parent-doc-item" variants={fadeUp} initial="hidden" animate="show" custom={i}>
                        <FileText size={16} style={{ color: "#c8416a" }} />
                        <div style={{ flex: 1 }}>
                          <div className="vtx-parent-doc-name">{doc.file_name}</div>
                          <div className="vtx-parent-doc-date">{new Date(doc.uploaded_at).toLocaleDateString()}</div>
                        </div>
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
