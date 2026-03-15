"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  LogOut,
  Upload,
  Video,
  CheckCircle,
  FileText,
  Clock,
  Loader2,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Parent, Child, UploadedDocument, TutoringSession } from "@/types";
import { VertexLogo } from "@/components/vertex/vertex-logo";
import "@/styles/vertex.css";

type ViewState = "locked" | "unlocked";

export default function ParentProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [viewState, setViewState] = useState<ViewState>("locked");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  const [parent, setParent] = useState<Parent | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [sessions, setSessions] = useState<TutoringSession[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tutorReady, setTutorReady] = useState(false);
  const [tutorName, setTutorName] = useState("Tina");

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserEmail(user.email || "");
      setUserId(user.id);
    })();
  }, [router, supabase]);

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const [parentRes, childrenRes, docsRes, sessionsRes] = await Promise.all([
      supabase.from("parents").select("*").eq("id", user.id).single(),
      supabase.from("children").select("*").eq("parent_id", user.id).order("created_at", { ascending: true }),
      supabase
        .from("uploaded_documents")
        .select("*")
        .eq("parent_id", user.id)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("tutoring_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20),
    ]);

    if (parentRes.data) setParent(parentRes.data);
    if (childrenRes.data) {
      setChildren(childrenRes.data);
      setSelectedChildId((current) => current || childrenRes.data[0]?.id || "");
    }
    if (docsRes.data) setDocuments(docsRes.data);
    if (sessionsRes.data) setSessions(sessionsRes.data);

    try {
      const tutorRes = await fetch(`/api/student/tutor?parentId=${user.id}`);
      const tutorData = await tutorRes.json().catch(() => ({}));
      setTutorReady(Boolean(tutorData.tutor?.liveTutorEnabled));
      setTutorName(tutorData.tutor?.avatarName || "Tina");
    } catch {
      setTutorReady(false);
      setTutorName("Tina");
    }
  }, [supabase]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password,
    });

    if (error) {
      setAuthError("Incorrect password");
      setAuthLoading(false);
      return;
    }

    setViewState("unlocked");
    setAuthLoading(false);
    void loadData();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !selectedChildId) return;

    setUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("childId", selectedChildId);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        await loadData();
      }
    } catch (error) {
      console.error("Homework upload error:", error);
    }

    setUploading(false);
    e.target.value = "";
  }

  const selectedChild = children.find((child) => child.id === selectedChildId) || null;

  if (viewState === "locked") {
    return (
      <div className="vtx-auth-page">
        <div className="vtx-auth-page-logo">
          <VertexLogo href="/" height={56} className="vtx-auth-logo" />
        </div>
        <div className="vtx-auth-card">
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              color: "#8a7f6e",
              fontSize: 11,
              cursor: "pointer",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 24,
            }}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <h1>Parent Access</h1>
          <p className="vtx-auth-sub">Enter your password to continue</p>

          <div className="vtx-auth-form">
            <form onSubmit={handlePasswordSubmit}>
              <div className="vtx-field">
                <label htmlFor="parent-password">Password</label>
                <input
                  id="parent-password"
                  type="password"
                  placeholder="Your account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {authError && <div className="vtx-auth-error">{authError}</div>}

              <button type="submit" disabled={authLoading} className="vtx-auth-btn">
                {authLoading ? "Verifying..." : "Continue"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        overflowX: "hidden",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        background: "#f4efe5",
        fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
        color: "#1e1a12",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          borderBottom: "1px solid rgba(55,45,25,0.10)",
          padding: "20px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(248,243,232,0.95)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              color: "#8a7f6e",
              fontSize: 11,
              cursor: "pointer",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            <ArrowLeft size={14} /> Dashboard
          </button>
          <div style={{
            width: 1, height: 20, background: "rgba(55,45,25,0.10)",
          }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <VertexLogo height={48} transparentBg={true} />
            <div style={{ fontSize: 12, color: "#8a7f6e" }}>
              Parent Profile
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "1px solid rgba(55,45,25,0.10)",
            borderRadius: 3,
            padding: "8px 16px",
            color: "#8a7f6e",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          <LogOut size={14} /> Sign Out
        </button>
      </header>

      <main style={{ flex: 1, overflowY: "auto", maxWidth: 960, margin: "0 auto", padding: "40px 24px" }}>
        <section
          style={{
            padding: "32px 28px",
            background: "#f8f3e8",
            border: "1px solid rgba(55,45,25,0.10)",
            borderRadius: 4,
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 4,
                background: "rgba(158,107,117,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Video size={18} style={{ color: "#c8416a" }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>Tutor Avatar</div>
              <p style={{ fontSize: 12, color: "#8a7f6e", marginTop: 2 }}>
                This build uses the Simli + LiveKit tutor named {tutorName}. Parent photo cloning is paused for now.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(240px, 320px) 1fr",
              gap: 20,
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                minHeight: 260,
                borderRadius: 18,
                overflow: "hidden",
                background:
                  "radial-gradient(circle at top, rgba(255,255,255,0.16), transparent 45%), linear-gradient(180deg, #1d2431 0%, #111723 100%)",
                border: "1px solid rgba(55,45,25,0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                color: "#fff6eb",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  fontSize: 38,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                {tutorName.charAt(0).toUpperCase()}
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>{tutorName}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,246,235,0.8)" }}>
                Live math tutor powered by OpenAI, rendered through Simli, and delivered in a LiveKit room.
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  background: tutorReady ? "rgba(92,124,106,0.10)" : "rgba(200,65,106,0.06)",
                  borderRadius: 4,
                  border: tutorReady
                    ? "1px solid rgba(92,124,106,0.18)"
                    : "1px solid rgba(200,65,106,0.16)",
                  color: tutorReady ? "#5c7c6a" : "#8a243f",
                }}
              >
                <CheckCircle size={16} />
                <span style={{ fontSize: 13 }}>
                  {tutorReady
                    ? `${tutorName} is ready for live sessions.`
                    : `${tutorName} still needs the Simli and LiveKit environment variables before live sessions can start.`}
                </span>
              </div>

              <div
                style={{
                  padding: "18px",
                  background: "rgba(255,255,255,0.48)",
                  borderRadius: 4,
                  border: "1px solid rgba(55,45,25,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#8a7f6e",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Workflow
                </div>
                <div style={{ display: "grid", gap: 10, fontSize: 13, lineHeight: 1.55, color: "#3d3126" }}>
                  <div>
                    <strong>1.</strong> Parent saves learning topics and uploads homework.
                  </div>
                  <div>
                    <strong>2.</strong> Start the local LiveKit server and the Simli agent worker for development.
                  </div>
                  <div>
                    <strong>3.</strong> Child logs in with the access code and talks to {tutorName} in real time.
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "18px",
                  background: "rgba(255,255,255,0.48)",
                  borderRadius: 4,
                  border: "1px solid rgba(55,45,25,0.08)",
                }}
              >
                <div
                  style={{
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
                  }}
                >
                  <Sparkles size={14} />
                  Math Only
                </div>
                <p style={{ fontSize: 13, color: "#6f6659", lineHeight: 1.6, margin: 0 }}>
                  {tutorName} is configured as a math-focused tutor. If the child wanders into unrelated topics, the live agent redirects the conversation back to math help.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            padding: "32px 28px",
            background: "#f8f3e8",
            border: "1px solid rgba(55,45,25,0.10)",
            borderRadius: 4,
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 4,
                background: "rgba(158,107,117,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Upload size={18} style={{ color: "#c8416a" }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>Upload Homework</div>
              <p style={{ fontSize: 12, color: "#8a7f6e", marginTop: 2 }}>
                Upload a worksheet or class assignment for the child&apos;s tutoring sessions.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                style={{
                  minWidth: 220,
                  padding: "12px 14px",
                  border: "1px solid rgba(55,45,25,0.12)",
                  borderRadius: 4,
                  background: "#fffdf8",
                  color: "#1e1a12",
                }}
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 18px",
                  background: "#c8416a",
                  color: "#fff",
                  borderRadius: 4,
                  cursor: uploading || !selectedChild ? "not-allowed" : "pointer",
                  opacity: uploading || !selectedChild ? 0.6 : 1,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontSize: 11,
                }}
              >
                {uploading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={14} />}
                {uploading ? "Uploading..." : "Choose PDF File"}
                <input
                  type="file"
                  accept="application/pdf"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                  disabled={uploading || !selectedChild}
                />
              </label>
            </div>

            {documents.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                {documents.slice(0, 5).map((document) => (
                  <div
                    key={document.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.52)",
                      border: "1px solid rgba(55,45,25,0.08)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <FileText size={16} style={{ color: "#c8416a" }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{document.file_name}</div>
                        <div style={{ fontSize: 11, color: "#8a7f6e" }}>
                          {new Date(document.uploaded_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#8a7f6e" }}>
                      {document.child_id === selectedChild?.id ? "Current child" : "Saved"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          style={{
            padding: "32px 28px",
            background: "#f8f3e8",
            border: "1px solid rgba(55,45,25,0.10)",
            borderRadius: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 4,
                background: "rgba(158,107,117,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock size={18} style={{ color: "#c8416a" }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>Session History</div>
              <p style={{ fontSize: 12, color: "#8a7f6e", marginTop: 2 }}>
                {sessions.length} recent tutoring sessions
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {sessions.length === 0 ? (
              <div
                style={{
                  padding: "18px 20px",
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.52)",
                  border: "1px solid rgba(55,45,25,0.08)",
                  color: "#8a7f6e",
                  fontSize: 13,
                }}
              >
                No tutoring sessions yet.
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "16px 18px",
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.52)",
                    border: "1px solid rgba(55,45,25,0.08)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {session.status === "completed" ? "Completed" : "In progress"}
                    </div>
                    <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 4 }}>
                      {new Date(session.started_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#8a7f6e" }}>
                    {typeof session.focus_score_avg === "number"
                      ? `${Math.round(session.focus_score_avg)}% focus`
                      : "Focus pending"}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div style={{ fontSize: 11, color: "#afa598", marginTop: 18, textAlign: "center" }}>
          Signed in as {parent?.name || userEmail || userId}
        </div>
      </main>
    </div>
  );
}
