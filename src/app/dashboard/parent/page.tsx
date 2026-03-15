"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, BookOpen, FileText, Settings, Copy, Plus,
  LogOut, ChevronRight, Users, Eye, X, TrendingUp, Activity,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  Parent, AccessCode, TutoringSession, UploadedDocument,
  FocusEvent,
} from "@/types";
import "@/styles/vertex.css";

type Tab = "overview" | "progress" | "homework" | "analytics" | "settings";
type SettingsSaveSection = "account" | "learning" | "notifications";
type SettingsFeedback = {
  type: "success" | "error";
  message: string;
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
    childName: "",
    childAge: "",
    gradeLevel: "",
    mathTopics: [] as string[],
    learningPace: "medium" as "slow" | "medium" | "fast",
  });
  const [settingsAccountEditing, setSettingsAccountEditing] = useState(false);
  const [settingsAccountForm, setSettingsAccountForm] = useState({ name: "", childName: "", gradeLevel: "" });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSavingSection, setSettingsSavingSection] = useState<SettingsSaveSection | null>(null);
  const [settingsLearningTopics, setSettingsLearningTopics] = useState<string[]>([]);
  const [settingsLearningPace, setSettingsLearningPace] = useState<"slow" | "medium" | "fast">("medium");
  const [settingsLearningFeedback, setSettingsLearningFeedback] = useState<SettingsFeedback | null>(null);

  const topicOptions = [
    "Addition", "Subtraction", "Multiplication", "Division",
    "Fractions", "Decimals", "Geometry", "Algebra",
    "Word Problems", "Measurement", "Time", "Money",
  ];
  function toggleCodeFormTopic(topic: string) {
    setCodeForm((prev) => ({
      ...prev,
      mathTopics: prev.mathTopics.includes(topic) ? prev.mathTopics.filter((t) => t !== topic) : [...prev.mathTopics, topic],
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

    // Load access codes
    try {
      const codesRes = await fetch("/api/access-code");
      const codesData = await codesRes.json();
      if (codesData.codes) setAccessCodes(codesData.codes);
    } catch { /* ignore */ }

    // Load recent focus events
    if (sessionsRes.data?.length) {
      const recentSessionIds = sessionsRes.data.slice(0, 5).map((s: TutoringSession) => s.id);
      const { data: events } = await supabase
        .from("focus_events")
        .select("*")
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

  async function updateParentProfile(
    payload: Record<string, unknown>,
    section: SettingsSaveSection
  ): Promise<{ ok: true; data: Parent } | { ok: false; error: string }> {
    setSettingsSaving(true);
    setSettingsSavingSection(section);
    try {
      const res = await fetch("/api/parent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data) {
        setParent(data);
        return { ok: true, data };
      }
      return { ok: false, error: data?.error || "Could not save changes. Please try again." };
    } catch {
      return { ok: false, error: "Could not save changes. Please try again." };
    } finally {
      setSettingsSaving(false);
      setSettingsSavingSection(null);
    }
  }

  function startEditAccount() {
    if (parent) {
      setSettingsAccountForm({
        name: parent.name || "",
        childName: parent.child_name || "",
        gradeLevel: parent.grade_level || "",
      });
      setSettingsAccountEditing(true);
    }
  }

  async function saveAccountSettings(e: React.FormEvent) {
    e.preventDefault();
    const result = await updateParentProfile({
      name: settingsAccountForm.name.trim(),
      child_name: settingsAccountForm.childName.trim() || null,
      grade_level: settingsAccountForm.gradeLevel.trim() || null,
    }, "account");
    if (result.ok) setSettingsAccountEditing(false);
  }

  function toggleSettingsTopic(topic: string) {
    setSettingsLearningFeedback(null);
    setSettingsLearningTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  }

  async function saveLearningSettings() {
    const result = await updateParentProfile({
      math_topics: settingsLearningTopics,
      learning_pace: settingsLearningPace,
    }, "learning");

    if (result.ok) {
      setSettingsLearningFeedback({
        type: "success",
        message: buildLearningConfigSuccessMessage(settingsLearningTopics, settingsLearningPace),
      });
      return;
    }

    setSettingsLearningFeedback({
      type: "error",
      message: result.error,
    });
  }

  async function toggleNotificationRealtime() {
    await updateParentProfile({ notification_realtime: !parent?.notification_realtime }, "notifications");
  }

  async function toggleNotificationDaily() {
    await updateParentProfile({ notification_daily: !parent?.notification_daily }, "notifications");
  }

  async function submitCodeForm(e: React.FormEvent) {
    e.preventDefault();
    setCodeError(null);
    const age = parseInt(codeForm.childAge, 10);
    if (!codeForm.childName.trim()) {
      setCodeError("Child's name is required.");
      return;
    }
    if (!codeForm.childAge || isNaN(age) || age < 3 || age > 18) {
      setCodeError("Child's age is required and must be between 3 and 18.");
      return;
    }
    if (!codeForm.gradeLevel.trim()) {
      setCodeError("Grade level is required.");
      return;
    }
    setGeneratingCode(true);
    try {
      const res = await fetch("/api/access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: codeForm.childName.trim(),
          childAge: age,
          gradeLevel: codeForm.gradeLevel.trim(),
          mathTopics: codeForm.mathTopics,
          learningPace: codeForm.learningPace,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCodeForm(false);
        setCodeForm({ childName: "", childAge: "", gradeLevel: "", mathTopics: [], learningPace: "medium" });
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

  // Stats
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const todaySessions = sessions.filter((s) => {
    const d = new Date(s.started_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });
  const avgFocus = completedSessions.length
    ? Math.round(completedSessions.reduce((sum, s) => sum + (s.focus_score_avg || 0), 0) / completedSessions.length)
    : 0;
  const settingsLearningDirty = parent
    ? !haveSameTopicSelections(parent.math_topics || [], settingsLearningTopics) ||
      (parent.learning_pace || "medium") !== settingsLearningPace
    : false;

  const sidebarItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart3 size={18} /> },
    { id: "progress", label: "Progress", icon: <ChevronRight size={18} /> },
    { id: "homework", label: "Homework", icon: <BookOpen size={18} /> },
    { id: "analytics", label: "Analytics", icon: <TrendingUp size={18} /> },
    { id: "settings", label: "Settings", icon: <Settings size={18} /> },
  ];

  if (loading) {
    return (
      <div className="vtx-auth-page">
        <p style={{ color: "#8a7f6e", fontSize: 13 }}>Loading...</p>
      </div>
    );
  }

  const s = {
    page: { display: "flex", height: "100vh", overflow: "hidden", background: "#f4efe5", fontFamily: "'Calibri', 'Trebuchet MS', sans-serif", color: "#1e1a12" } as React.CSSProperties,
    sidebar: { width: 240, borderRight: "1px solid rgba(55,45,25,0.10)", background: "rgba(248,243,232,0.95)", display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0 } as React.CSSProperties,
    sidebarHeader: { padding: "0 24px 32px", borderBottom: "1px solid rgba(55,45,25,0.10)", marginBottom: 16 } as React.CSSProperties,
    sidebarItem: (active: boolean) => ({
      display: "flex", alignItems: "center", gap: 12, padding: "12px 24px",
      color: active ? "#c8416a" : "#8a7f6e", background: active ? "rgba(158,107,117,0.06)" : "transparent",
      border: "none", cursor: "pointer", width: "100%", textAlign: "left" as const,
      fontSize: 13, letterSpacing: "0.05em", transition: "all 0.2s",
      fontFamily: "'Calibri', 'Trebuchet MS', sans-serif", borderLeft: active ? "2px solid #c8416a" : "2px solid transparent",
    }) as React.CSSProperties,
    main: { flex: 1, padding: "32px 40px", overflowY: "auto" } as React.CSSProperties,
    card: { padding: "24px 28px", background: "#f8f3e8", border: "1px solid rgba(55,45,25,0.10)", borderRadius: 4, marginBottom: 20 } as React.CSSProperties,
    statCard: { padding: "20px 24px", background: "#f8f3e8", border: "1px solid rgba(55,45,25,0.10)", borderRadius: 4 } as React.CSSProperties,
    h2: { fontSize: 20, fontWeight: 500, marginBottom: 20 } as React.CSSProperties,
    label: { fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "#8a7f6e", marginBottom: 4 } as React.CSSProperties,
    bigNum: { fontSize: 36, fontWeight: 300, color: "#c8416a" } as React.CSSProperties,
    btn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: "#c8416a", color: "#fff", border: "none", borderRadius: 3, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" as const, cursor: "pointer" } as React.CSSProperties,
    btnOutline: { display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: "transparent", color: "#8a7f6e", border: "1px solid rgba(55,45,25,0.12)", borderRadius: 3, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" as const, cursor: "pointer" } as React.CSSProperties,
  };

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" }}>Vertex</div>
          <div style={{ fontSize: 12, color: "#8a7f6e", marginTop: 4 }}>{parent?.name || "Parent"}</div>
        </div>
        {sidebarItems.map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} style={s.sidebarItem(activeTab === item.id)}>
            {item.icon} {item.label}
          </button>
        ))}
        <div style={{ marginTop: "auto", padding: "16px 24px" }}>
          <button onClick={handleSignOut} style={{ ...s.btnOutline, width: "100%", justifyContent: "center" }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={s.main}>
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 8 }}>
              Welcome back, {parent?.name?.split(" ")[0]}
            </h1>
            <p style={{ color: "#8a7f6e", fontSize: 13, marginBottom: 32 }}>
              Here&apos;s how {parent?.child_name || "your child"} is doing
            </p>

            {/* Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 32 }}>
              <div style={s.statCard}>
                <div style={s.label}>Study Today</div>
                <div style={s.bigNum}>{todaySessions.length}</div>
                <div style={{ fontSize: 11, color: "#8a7f6e" }}>sessions</div>
              </div>
              <div style={s.statCard}>
                <div style={s.label}>Avg Focus</div>
                <div style={s.bigNum}>{avgFocus}%</div>
                <div style={{ fontSize: 11, color: "#8a7f6e" }}>across sessions</div>
              </div>
              <div style={s.statCard}>
                <div style={s.label}>Homework</div>
                <div style={s.bigNum}>{documents.length}</div>
                <div style={{ fontSize: 11, color: "#8a7f6e" }}>uploaded</div>
              </div>
              <div style={s.statCard}>
                <div style={s.label}>Distractions</div>
                <div style={s.bigNum}>{focusEvents.length}</div>
                <div style={{ fontSize: 11, color: "#8a7f6e" }}>events logged</div>
              </div>
            </div>

            {/* Access Codes */}
            <div style={s.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Users size={18} style={{ color: "#c8416a" }} />
                  <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Access Codes</h2>
                </div>
                {!showCodeForm && (
                  <button onClick={() => { setShowCodeForm(true); setCodeError(null); }} style={s.btn}>
                    <Plus size={14} /> New Code
                  </button>
                )}
              </div>

              {showCodeForm && (
                <form onSubmit={submitCodeForm} style={{ marginBottom: 20, padding: "16px 0", borderTop: "1px solid rgba(55,45,25,0.08)" }}>
                  <p style={{ fontSize: 12, color: "#8a7f6e", marginBottom: 12 }}>Each code is for one child. Enter their details below.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={s.label}>Child&apos;s name <span style={{ color: "#c8416a" }}>*</span></label>
                      <input type="text" placeholder="Full name" value={codeForm.childName} onChange={(e) => setCodeForm((p) => ({ ...p, childName: e.target.value }))} required style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(55,45,25,0.12)", borderRadius: 3, fontSize: 13, fontFamily: "'Calibri', 'Trebuchet MS', sans-serif" }} />
                    </div>
                    <div>
                      <label style={s.label}>Age (3–18) <span style={{ color: "#c8416a" }}>*</span></label>
                      <input type="number" min={3} max={18} placeholder="e.g. 8" value={codeForm.childAge} onChange={(e) => setCodeForm((p) => ({ ...p, childAge: e.target.value }))} required style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(55,45,25,0.12)", borderRadius: 3, fontSize: 13, fontFamily: "'Calibri', 'Trebuchet MS', sans-serif" }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={s.label}>Grade level <span style={{ color: "#c8416a" }}>*</span></label>
                    <input type="text" placeholder="e.g. 3rd grade" value={codeForm.gradeLevel} onChange={(e) => setCodeForm((p) => ({ ...p, gradeLevel: e.target.value }))} required style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(55,45,25,0.12)", borderRadius: 3, fontSize: 13, fontFamily: "'Calibri', 'Trebuchet MS', sans-serif" }} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={s.label}>Math topics they struggle with</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {topicOptions.map((topic) => (
                        <button key={topic} type="button" onClick={() => toggleCodeFormTopic(topic)} style={{
                          padding: "6px 10px", fontSize: 11, borderRadius: 3, border: `1.5px solid ${codeForm.mathTopics.includes(topic) ? "#c8416a" : "rgba(55,45,25,0.12)"}`,
                          background: codeForm.mathTopics.includes(topic) ? "rgba(200,65,106,0.08)" : "transparent", color: codeForm.mathTopics.includes(topic) ? "#c8416a" : "#1e1a12",
                          cursor: "pointer", fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                        }}>{topic}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={s.label}>Learning pace</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["slow", "medium", "fast"] as const).map((pace) => (
                        <button key={pace} type="button" onClick={() => setCodeForm((p) => ({ ...p, learningPace: pace }))} style={{
                          padding: "8px 14px", fontSize: 12, borderRadius: 3, border: `1.5px solid ${codeForm.learningPace === pace ? "#c8416a" : "rgba(55,45,25,0.12)"}`,
                          background: codeForm.learningPace === pace ? "rgba(200,65,106,0.08)" : "transparent", color: codeForm.learningPace === pace ? "#c8416a" : "#1e1a12",
                          cursor: "pointer", fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                          textTransform: "capitalize",
                        }}>{pace === "slow" ? "Slow & steady" : pace === "medium" ? "Balanced" : "Quick"}</button>
                      ))}
                    </div>
                  </div>
                  {codeError && <p style={{ fontSize: 13, color: "#944040", marginBottom: 8 }}>{codeError}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" disabled={generatingCode} style={s.btn}>
                      {generatingCode ? "Creating..." : "Create access code"}
                    </button>
                    <button type="button" onClick={() => { setShowCodeForm(false); setCodeError(null); }} style={s.btnOutline}>Cancel</button>
                  </div>
                </form>
              )}

              {codeError && !showCodeForm && (
                <p style={{ fontSize: 13, color: "#944040", marginBottom: 12 }}>{codeError}</p>
              )}

              {accessCodes.filter((c) => c.is_active).length === 0 && !showCodeForm ? (
                <p style={{ fontSize: 13, color: "#8a7f6e" }}>
                  No active codes. Create one for your child to start learning!
                </p>
              ) : !showCodeForm ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {accessCodes.filter((c) => c.is_active).map((ac) => (
                    <div key={ac.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 16px", background: "rgba(244,239,229,0.5)", borderRadius: 3,
                      border: "1px solid rgba(55,45,25,0.06)",
                    }}>
                      <div>
                        <span style={{ fontSize: 24, fontWeight: 300, letterSpacing: "0.3em", fontFamily: "monospace" }}>
                          {ac.code}
                        </span>
                        <span style={{ fontSize: 12, color: "#8a7f6e", marginLeft: 12 }}>
                          {ac.child_name || "Unnamed"}
                          {ac.child_age != null && `, age ${ac.child_age}`}
                          {ac.grade_level && ` · ${ac.grade_level}`}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => copyCode(ac.code)} style={s.btnOutline}>
                          <Copy size={12} /> {copiedCode === ac.code ? "Copied!" : "Copy"}
                        </button>
                        <button type="button" onClick={() => deactivateCode(ac.id)} style={{ ...s.btnOutline, color: "#944040" }}>
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Recent Sessions */}
            {sessions.length > 0 && (
              <div style={s.card}>
                <h2 style={s.h2}>Recent Sessions</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sessions.slice(0, 5).map((session) => (
                    <div key={session.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", background: "rgba(244,239,229,0.5)", borderRadius: 3,
                      border: "1px solid rgba(55,45,25,0.06)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: session.status === "active" ? "#5a9e76" : "#afa598",
                        }} />
                        <div>
                          <div style={{ fontSize: 13 }}>
                            {session.status === "active" ? "In Progress" : "Completed"}
                          </div>
                          <div style={{ fontSize: 11, color: "#8a7f6e" }}>
                            {new Date(session.started_at).toLocaleDateString()} at {new Date(session.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {session.focus_score_avg != null && (
                          <span style={{
                            fontSize: 12, padding: "4px 10px", borderRadius: 3,
                            background: session.focus_score_avg >= 75 ? "rgba(92,124,106,0.12)" : session.focus_score_avg >= 50 ? "rgba(166,124,74,0.1)" : "rgba(158,107,117,0.1)",
                            color: session.focus_score_avg >= 75 ? "#2d7a4a" : session.focus_score_avg >= 50 ? "#c89020" : "#c8416a",
                          }}>
                            {Math.round(session.focus_score_avg)}% focus
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* PROGRESS TAB */}
        {activeTab === "progress" && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 32 }}>Progress</h1>
            {completedSessions.length === 0 ? (
              <div style={s.card}>
                <p style={{ fontSize: 13, color: "#8a7f6e" }}>No completed sessions yet. Sessions will appear here once your child starts studying!</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {completedSessions.map((session) => (
                  <div key={session.id} style={s.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {new Date(session.started_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                        </div>
                        <div style={{ fontSize: 12, color: "#8a7f6e", marginTop: 2 }}>
                          {session.ended_at ? `${Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000)} min` : "—"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={s.label}>Focus</div>
                          <div style={{ fontSize: 20, fontWeight: 300, color: (session.focus_score_avg || 0) >= 75 ? "#5a9e76" : "#c8416a" }}>
                            {session.focus_score_avg != null ? `${Math.round(session.focus_score_avg)}%` : "—"}
                          </div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={s.label}>Status</div>
                          <div style={{ fontSize: 12, color: "#5a9e76" }}>
                            {session.status}
                          </div>
                        </div>
                      </div>
                    </div>
                    {session.session_summary && (
                      <p style={{ fontSize: 12, color: "#8a7f6e", marginTop: 12, lineHeight: 1.6 }}>
                        {session.session_summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* HOMEWORK TAB */}
        {activeTab === "homework" && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 32 }}>Homework</h1>
            <div style={s.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <BookOpen size={18} style={{ color: "#c8416a" }} />
                <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Upload Homework</h2>
              </div>
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "20px", border: "1.5px dashed rgba(158,107,117,0.22)", borderRadius: 4,
                color: "#c8416a", fontSize: 12, letterSpacing: "0.12em",
                textTransform: "uppercase", cursor: "pointer",
              }}>
                <FileText size={16} /> Choose PDF File
                <input type="file" accept=".pdf" style={{ display: "none" }} onChange={async (e) => {
                  if (!e.target.files?.[0]) return;
                  const formData = new FormData();
                  formData.append("file", e.target.files[0]);
                  await fetch("/api/upload", { method: "POST", body: formData });
                  await loadData();
                }} />
              </label>
            </div>

            {documents.length > 0 && (
              <div style={s.card}>
                <h2 style={s.h2}>Uploaded Files</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {documents.map((doc) => (
                    <div key={doc.id} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                      background: "rgba(244,239,229,0.5)", borderRadius: 3, border: "1px solid rgba(55,45,25,0.06)",
                    }}>
                      <FileText size={16} style={{ color: "#c8416a" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{doc.file_name}</div>
                        <div style={{ fontSize: 11, color: "#8a7f6e" }}>{new Date(doc.uploaded_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 8 }}>Analytics</h1>
            <p style={{ color: "#8a7f6e", fontSize: 13, marginBottom: 32 }}>
              How {parent?.child_name || "your child"} uses Vertex
            </p>

            {sessions.length === 0 ? (
              <div style={s.card}>
                <p style={{ fontSize: 13, color: "#8a7f6e" }}>
                  No activity yet. Analytics will appear once your child starts study sessions.
                </p>
              </div>
            ) : (
              <>
                {/* Summary stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16, marginBottom: 32 }}>
                  <div style={s.statCard}>
                    <div style={s.label}>Total Sessions</div>
                    <div style={s.bigNum}>{completedSessions.length}</div>
                    <div style={{ fontSize: 11, color: "#8a7f6e" }}>completed</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.label}>Avg Focus</div>
                    <div style={s.bigNum}>{avgFocus}%</div>
                    <div style={{ fontSize: 11, color: "#8a7f6e" }}>across sessions</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.label}>Distraction Events</div>
                    <div style={s.bigNum}>{focusEvents.length}</div>
                    <div style={{ fontSize: 11, color: "#8a7f6e" }}>logged</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.label}>Study This Week</div>
                    <div style={s.bigNum}>
                      {sessions.filter((s) => {
                        const d = new Date(s.started_at);
                        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
                        return d >= weekAgo;
                      }).length}
                    </div>
                    <div style={{ fontSize: 11, color: "#8a7f6e" }}>sessions</div>
                  </div>
                </div>

                {/* Sessions per day (last 7 days) */}
                <div style={s.card}>
                  <h2 style={s.h2}>Sessions per day (last 7 days)</h2>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 140, marginTop: 16 }}>
                    {(() => {
                      const days: { label: string; count: number }[] = [];
                      for (let i = 6; i >= 0; i--) {
                        const d = new Date(); d.setDate(d.getDate() - i);
                        const dayStr = d.toISOString().split("T")[0];
                        const count = sessions.filter((s) => new Date(s.started_at).toISOString().split("T")[0] === dayStr).length;
                        days.push({
                          label: d.toLocaleDateString("en-US", { weekday: "short" }),
                          count,
                        });
                      }
                      const max = Math.max(1, ...days.map((x) => x.count));
                      return days.map((day, i) => (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: "100%", borderRadius: 4, background: "rgba(200,65,106,0.2)",
                            height: day.count ? `${Math.round((day.count / max) * 100)}%` : "4px",
                            minHeight: day.count ? 24 : 4,
                            transition: "height 0.3s",
                          }} />
                          <span style={{ fontSize: 11, color: "#8a7f6e" }}>{day.count}</span>
                          <span style={{ fontSize: 10, color: "#8a7f6e", letterSpacing: "0.05em" }}>{day.label}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Focus score trend (last 7 completed sessions) */}
                <div style={{ ...s.card, marginTop: 20 }}>
                  <h2 style={s.h2}>Focus score trend</h2>
                  <p style={{ fontSize: 12, color: "#8a7f6e", marginBottom: 16 }}>
                    Average focus % for the last completed sessions
                  </p>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
                    {completedSessions.slice(0, 7).reverse().map((session, i) => {
                      const score = session.focus_score_avg ?? 0;
                      return (
                        <div key={session.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <div style={{
                            width: "100%", borderRadius: 4, background: score >= 75 ? "rgba(90,158,118,0.25)" : score >= 50 ? "rgba(200,144,32,0.2)" : "rgba(200,65,106,0.2)",
                            height: `${Math.min(100, score)}%`, minHeight: score > 0 ? 16 : 4,
                            transition: "height 0.3s",
                          }} />
                          <span style={{ fontSize: 10, fontWeight: 500, color: "#1e1a12" }}>{Math.round(score)}%</span>
                          <span style={{ fontSize: 9, color: "#8a7f6e" }}>Session {completedSessions.length - i}</span>
                        </div>
                      );
                    })}
                    {completedSessions.length === 0 && (
                      <span style={{ fontSize: 13, color: "#8a7f6e" }}>No completed sessions yet</span>
                    )}
                  </div>
                </div>

                {/* Focus events breakdown */}
                {focusEvents.length > 0 && (
                  <div style={{ ...s.card, marginTop: 20 }}>
                    <h2 style={s.h2}>Distraction breakdown</h2>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
                      {["tab_blur", "inactive", "face_absent", "no_response"].map((eventType) => {
                        const count = focusEvents.filter((e) => e.event_type === eventType).length;
                        const label = eventType.replace("_", " ");
                        return (
                          <div key={eventType} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "12px 16px", background: "rgba(244,239,229,0.6)", borderRadius: 4,
                            border: "1px solid rgba(55,45,25,0.06)",
                          }}>
                            <Activity size={16} style={{ color: "#c8416a" }} />
                            <div>
                              <div style={{ fontSize: 12, textTransform: "capitalize", color: "#1e1a12" }}>{label}</div>
                              <div style={{ fontSize: 18, fontWeight: 300, color: "#c8416a" }}>{count}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 32 }}>Settings</h1>

            <div style={s.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 style={{ ...s.h2, marginBottom: 0 }}>Account</h2>
                {!settingsAccountEditing && (
                  <button type="button" onClick={startEditAccount} style={s.btnOutline} disabled={settingsSaving}>
                    Edit
                  </button>
                )}
              </div>
              {settingsAccountEditing ? (
                <form onSubmit={saveAccountSettings}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div>
                      <label style={s.label}>Name</label>
                      <input
                        type="text"
                        value={settingsAccountForm.name}
                        onChange={(e) => setSettingsAccountForm((p) => ({ ...p, name: e.target.value }))}
                        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(55,45,25,0.12)", borderRadius: 3, fontSize: 14, marginTop: 4, fontFamily: "'Calibri', 'Trebuchet MS', sans-serif" }}
                      />
                    </div>
                    <div>
                      <div style={s.label}>Email</div>
                      <div style={{ fontSize: 14, marginTop: 4, color: "#8a7f6e" }}>{parent?.email}</div>
                      <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 2 }}>Managed by your sign-in account</div>
                    </div>
                    <div>
                      <label style={s.label}>Child&apos;s Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Alex"
                        value={settingsAccountForm.childName}
                        onChange={(e) => setSettingsAccountForm((p) => ({ ...p, childName: e.target.value }))}
                        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(55,45,25,0.12)", borderRadius: 3, fontSize: 14, marginTop: 4, fontFamily: "'Calibri', 'Trebuchet MS', sans-serif" }}
                      />
                    </div>
                    <div>
                      <label style={s.label}>Grade Level</label>
                      <input
                        type="text"
                        placeholder="e.g. 3rd grade"
                        value={settingsAccountForm.gradeLevel}
                        onChange={(e) => setSettingsAccountForm((p) => ({ ...p, gradeLevel: e.target.value }))}
                        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(55,45,25,0.12)", borderRadius: 3, fontSize: 14, marginTop: 4, fontFamily: "'Calibri', 'Trebuchet MS', sans-serif" }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" style={s.btn} disabled={settingsSaving}>
                      {settingsSaving && settingsSavingSection === "account" ? "Saving..." : "Save"}
                    </button>
                    <button type="button" onClick={() => setSettingsAccountEditing(false)} style={s.btnOutline}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={s.label}>Name</div>
                    <div style={{ fontSize: 14, marginTop: 4 }}>{parent?.name || "—"}</div>
                  </div>
                  <div>
                    <div style={s.label}>Email</div>
                    <div style={{ fontSize: 14, marginTop: 4 }}>{parent?.email || "—"}</div>
                  </div>
                  <div>
                    <div style={s.label}>Child&apos;s Name</div>
                    <div style={{ fontSize: 14, marginTop: 4 }}>{parent?.child_name || "—"}</div>
                  </div>
                  <div>
                    <div style={s.label}>Grade Level</div>
                    <div style={{ fontSize: 14, marginTop: 4 }}>{parent?.grade_level || "—"}</div>
                  </div>
                </div>
              )}
            </div>

            <div style={s.card}>
              <h2 style={s.h2}>Learning Configuration</h2>
              <div style={{ marginBottom: 16 }}>
                <div style={s.label}>Math Topics</div>
                <p style={{ fontSize: 12, color: "#8a7f6e", marginBottom: 6 }}>Select topics your child should focus on</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {topicOptions.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleSettingsTopic(topic)}
                      style={{
                        padding: "6px 12px", fontSize: 12, borderRadius: 3, border: `1.5px solid ${settingsLearningTopics.includes(topic) ? "#c8416a" : "rgba(55,45,25,0.12)"}`,
                        background: settingsLearningTopics.includes(topic) ? "rgba(200,65,106,0.08)" : "transparent",
                        color: settingsLearningTopics.includes(topic) ? "#c8416a" : "#1e1a12",
                        cursor: "pointer", fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                      }}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
                {settingsLearningTopics.length === 0 && (
                  <span style={{ fontSize: 13, color: "#8a7f6e", display: "block", marginTop: 6 }}>None selected</span>
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={s.label}>Learning Pace</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {(["slow", "medium", "fast"] as const).map((pace) => (
                    <button
                      key={pace}
                      type="button"
                      onClick={() => {
                        setSettingsLearningFeedback(null);
                        setSettingsLearningPace(pace);
                      }}
                      style={{
                        padding: "8px 14px", fontSize: 12, borderRadius: 3,
                        border: `1.5px solid ${settingsLearningPace === pace ? "#c8416a" : "rgba(55,45,25,0.12)"}`,
                        background: settingsLearningPace === pace ? "rgba(200,65,106,0.08)" : "transparent",
                        color: settingsLearningPace === pace ? "#c8416a" : "#1e1a12",
                        cursor: "pointer", fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                        textTransform: "capitalize",
                      }}
                    >
                      {pace === "slow" ? "Slow & steady" : pace === "medium" ? "Medium" : "Fast"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button type="button" onClick={saveLearningSettings} style={s.btn} disabled={settingsSaving || !settingsLearningDirty}>
                  {settingsSaving && settingsSavingSection === "learning" ? "Saving..." : "Save learning config"}
                </button>
                <span style={{
                  fontSize: 12,
                  color:
                    settingsLearningFeedback?.type === "error"
                      ? "#944040"
                      : settingsLearningFeedback?.type === "success"
                      ? "#2d7a4a"
                      : "#8a7f6e",
                }}>
                  {settingsSaving && settingsSavingSection === "learning"
                    ? "Updating your tutor preferences..."
                    : settingsLearningFeedback?.message
                    ? settingsLearningFeedback.message
                    : settingsLearningDirty
                    ? "You have unsaved changes. Save to update future tutor responses."
                    : "No changes to save. The tutor is already using these topics and pace."}
                </span>
              </div>
            </div>

            <div style={s.card}>
              <h2 style={s.h2}>Notifications</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14 }}>Real-time Focus Alerts</div>
                    <div style={{ fontSize: 12, color: "#8a7f6e" }}>Email when distraction level hits high</div>
                  </div>
                  <button
                    type="button"
                    aria-label={parent?.notification_realtime ? "Turn off real-time focus alerts" : "Turn on real-time focus alerts"}
                    onClick={toggleNotificationRealtime}
                    disabled={settingsSaving}
                    style={{
                      width: 36, height: 20, borderRadius: 10, cursor: settingsSaving ? "wait" : "pointer",
                      background: parent?.notification_realtime ? "#5a9e76" : "rgba(55,45,25,0.15)",
                      position: "relative", transition: "background 0.2s", border: "none", padding: 0, flexShrink: 0,
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 2,
                      left: parent?.notification_realtime ? 18 : 2, transition: "left 0.2s", display: "block",
                    }} />
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14 }}>Daily Summary</div>
                    <div style={{ fontSize: 12, color: "#8a7f6e" }}>Daily email summary of all activity</div>
                  </div>
                  <button
                    type="button"
                    aria-label={parent?.notification_daily ? "Turn off daily summary" : "Turn on daily summary"}
                    onClick={toggleNotificationDaily}
                    disabled={settingsSaving}
                    style={{
                      width: 36, height: 20, borderRadius: 10, cursor: settingsSaving ? "wait" : "pointer",
                      background: parent?.notification_daily ? "#5a9e76" : "rgba(55,45,25,0.15)",
                      position: "relative", transition: "background 0.2s", border: "none", padding: 0, flexShrink: 0,
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 2,
                      left: parent?.notification_daily ? 18 : 2, transition: "left 0.2s", display: "block",
                    }} />
                  </button>
                </div>
              </div>
            </div>

            <div style={s.card}>
              <h2 style={s.h2}>Tutor Avatar</h2>
              <button onClick={() => router.push("/parent")} style={s.btn}>
                <Eye size={14} /> Manage Avatar
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function haveSameTopicSelections(a: string[], b: string[]) {
  const normalizedA = [...a].sort().join("|");
  const normalizedB = [...b].sort().join("|");
  return normalizedA === normalizedB;
}

function buildLearningConfigSuccessMessage(
  topics: string[],
  pace: "slow" | "medium" | "fast"
) {
  const topicSummary = topics.length
    ? topics.length <= 3
      ? topics.join(", ")
      : `${topics.slice(0, 3).join(", ")} +${topics.length - 3} more`
    : "general math";

  const paceSummary =
    pace === "slow" ? "slow and steady"
    : pace === "fast" ? "fast-moving"
    : "balanced";

  return `Saved. The tutor will now prioritize ${topicSummary} with a ${paceSummary} pace.`;
}
