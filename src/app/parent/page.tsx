"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  LogOut,
  Upload,
  Video,
  Square,
  Circle,
  CheckCircle,
  FileText,
  Clock,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Parent, Child, UploadedDocument, TutoringSession } from "@/types";
import "@/styles/vertex.css";

type ViewState = "locked" | "unlocked";
type RecordingState = "idle" | "previewing" | "recording" | "recorded" | "uploading" | "done";

export default function ParentProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [viewState, setViewState] = useState<ViewState>("locked");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [parent, setParent] = useState<Parent | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [sessions, setSessions] = useState<TutoringSession[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [uploading, setUploading] = useState(false);

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoPlaybackRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email || "");
    })();
  }, [supabase, router]);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [parentRes, childrenRes, docsRes, sessionsRes] = await Promise.all([
      supabase.from("parents").select("*").eq("id", user.id).single(),
      supabase.from("children").select("*").eq("parent_id", user.id),
      supabase.from("uploaded_documents").select("*").eq("parent_id", user.id).order("uploaded_at", { ascending: false }),
      supabase.from("tutoring_sessions").select("*").order("started_at", { ascending: false }).limit(20),
    ]);

    if (parentRes.data) setParent(parentRes.data);
    if (childrenRes.data) {
      setChildren(childrenRes.data);
      if (childrenRes.data.length > 0 && !selectedChild) {
        setSelectedChild(childrenRes.data[0]);
      }
    }
    if (docsRes.data) setDocuments(docsRes.data);
    if (sessionsRes.data) setSessions(sessionsRes.data);
  }, [supabase, selectedChild]);

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
    loadData();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !selectedChild) return;
    setUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("childId", selectedChild.id);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) await loadData();
    } catch (err) { console.error("Upload error:", err); }
    setUploading(false);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      setRecordingState("previewing");
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Could not access camera. Please allow camera permissions.");
    }
  }

  useEffect(() => {
    if ((recordingState === "previewing" || recordingState === "recording") && streamRef.current && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = streamRef.current;
      videoPreviewRef.current.play().catch(() => {});
    }
    if (recordingState === "recorded" && recordedBlob && videoPlaybackRef.current) {
      videoPlaybackRef.current.src = URL.createObjectURL(recordedBlob);
    }
  }, [recordingState, recordedBlob]);

  useEffect(() => {
    if ((recordingState === "recorded" || recordingState === "uploading") && recordedBlob && videoPlaybackRef.current) {
      const url = URL.createObjectURL(recordedBlob);
      videoPlaybackRef.current.src = url;
      return () => URL.revokeObjectURL(url);
    }
  }, [recordingState, recordedBlob]);

  function startRecording() {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      setRecordingState("recorded");
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setRecordingState("recording");
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime((t) => t + 1);
    }, 1000);
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function discardRecording() {
    setRecordedBlob(null);
    setRecordingState("previewing");
    setRecordingTime(0);
    if (videoPlaybackRef.current) {
      videoPlaybackRef.current.src = "";
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current = null;
    setRecordedBlob(null);
    setRecordingState("idle");
    setRecordingTime(0);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      alert("Please select a video file (MP4, WebM, or MOV).");
      return;
    }
    setRecordedBlob(file);
    setRecordingState("recorded");
    e.target.value = "";
  }

  async function uploadRecording() {
    if (!recordedBlob) return;
    setRecordingState("uploading");

    const formData = new FormData();
    const name = recordedBlob instanceof File ? recordedBlob.name : "avatar-recording.webm";
    formData.append("video", recordedBlob, name);

    try {
      const res = await fetch("/api/heygen/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setRecordingState("done");
        stopCamera();
        await loadData();
      } else {
        alert(data.error || "Upload failed");
        setRecordingState("recorded");
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
      alert("Upload failed. Please try again.");
      setRecordingState("recorded");
    }
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function formatTime(s: number) {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  if (viewState === "locked") {
    return (
      <div className="vtx-auth-page">
        <div className="vtx-auth-card">
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "none",
              border: "none", color: "#8a7f6e", fontSize: 11, cursor: "pointer",
              letterSpacing: "0.12em", textTransform: "uppercase" as const,
              marginBottom: 24,
            }}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <div className="vtx-auth-logo">Vertex</div>
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
    <div style={{
      minHeight: "100vh", background: "#f4efe5",
      fontFamily: "'Calibri', 'Trebuchet MS', sans-serif", color: "#1e1a12",
    }}>
      <header style={{
        borderBottom: "1px solid rgba(55,45,25,0.10)",
        padding: "20px 48px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(248,243,232,0.95)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "none",
              border: "none", color: "#8a7f6e", fontSize: 11, cursor: "pointer",
              letterSpacing: "0.12em", textTransform: "uppercase" as const,
            }}
          >
            <ArrowLeft size={14} /> Dashboard
          </button>
          <div style={{
            width: 1, height: 20, background: "rgba(55,45,25,0.10)",
          }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" as const }}>
              Vertex
            </div>
            <div style={{ fontSize: 12, color: "#8a7f6e", marginTop: 2 }}>
              Parent Profile
            </div>
          </div>
        </div>
        <button onClick={handleSignOut} style={{
          display: "flex", alignItems: "center", gap: 6, background: "none",
          border: "1px solid rgba(55,45,25,0.10)", borderRadius: 3, padding: "8px 16px",
          color: "#8a7f6e", fontSize: 10, letterSpacing: "0.18em",
          textTransform: "uppercase" as const, cursor: "pointer",
        }}>
          <LogOut size={14} /> Sign Out
        </button>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px" }}>
        {/* Avatar Recording Section */}
        <div style={{
          padding: "32px 28px", background: "#f8f3e8", border: "1px solid rgba(55,45,25,0.10)",
          borderRadius: 4, marginBottom: 32,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 4, background: "rgba(158,107,117,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Video size={18} style={{ color: "#c8416a" }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>Tutor Avatar</div>
              <p style={{ fontSize: 12, color: "#8a7f6e", marginTop: 2 }}>
                Record a short video of yourself to create your AI tutor avatar
              </p>
            </div>
          </div>

          {parent?.heygen_avatar_id && recordingState === "idle" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
              background: "rgba(92,124,106,0.1)", borderRadius: 4, marginBottom: 16,
              border: "1px solid rgba(92,124,106,0.18)",
            }}>
              <CheckCircle size={16} style={{ color: "#5c7c6a" }} />
              <span style={{ fontSize: 13, color: "#5c7c6a" }}>Avatar created successfully</span>
            </div>
          )}

          {recordingState === "done" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
              background: "rgba(92,124,106,0.1)", borderRadius: 4, marginBottom: 16,
              border: "1px solid rgba(92,124,106,0.18)",
            }}>
              <CheckCircle size={16} style={{ color: "#5c7c6a" }} />
              <span style={{ fontSize: 13, color: "#5c7c6a" }}>Video uploaded! Your avatar is being processed.</span>
            </div>
          )}

          {recordingState === "idle" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ fontSize: 13, color: "#8a7f6e", marginBottom: 8, maxWidth: 420, margin: "0 auto 8px" }}>
                Look directly at the camera and speak naturally for 30 seconds to 2 minutes.
                This will be used to generate your personalized AI tutor avatar.
              </p>
              <p style={{ fontSize: 11, color: "#afa598", marginBottom: 20 }}>
                Supported formats: MP4, WebM, or MOV
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
                <button onClick={startCamera} style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "14px 24px", background: "#c8416a", color: "#fff",
                  border: "none", borderRadius: 3, fontSize: 12, letterSpacing: "0.15em",
                  textTransform: "uppercase" as const, cursor: "pointer",
                }}>
                  <Video size={16} /> Record Now
                </button>
                <label style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "14px 24px", background: "transparent", color: "#c8416a",
                  border: "1.5px solid rgba(158,107,117,0.35)", borderRadius: 3,
                  fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase" as const,
                  cursor: "pointer",
                }}>
                  <Upload size={16} /> Upload Video
                  <input
                    ref={fileUploadRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    style={{ display: "none" }}
                    onChange={handleFileSelect}
                  />
                </label>
              </div>
            </div>
          )}

          {(recordingState === "previewing" || recordingState === "recording") && (
            <div>
              <div style={{
                position: "relative", borderRadius: 6, overflow: "hidden",
                background: "#000", marginBottom: 16, aspectRatio: "16/9",
              }}>
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
                />
                {recordingState === "recording" && (
                  <div style={{
                    position: "absolute", top: 16, left: 16, display: "flex",
                    alignItems: "center", gap: 8, background: "rgba(0,0,0,0.6)",
                    padding: "6px 12px", borderRadius: 4,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", background: "#ef4444",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }} />
                    <span style={{ color: "#fff", fontSize: 13, fontFamily: "monospace" }}>
                      {formatTime(recordingTime)}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                {recordingState === "previewing" && (
                  <>
                    <button onClick={startRecording} style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "12px 24px", background: "#c8416a", color: "#fff",
                      border: "none", borderRadius: 3, fontSize: 11, letterSpacing: "0.15em",
                      textTransform: "uppercase" as const, cursor: "pointer",
                    }}>
                      <Circle size={14} /> Start Recording
                    </button>
                    <button onClick={stopCamera} style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "12px 24px", background: "transparent", color: "#8a7f6e",
                      border: "1px solid rgba(55,45,25,0.15)", borderRadius: 3,
                      fontSize: 11, letterSpacing: "0.15em",
                      textTransform: "uppercase" as const, cursor: "pointer",
                    }}>
                      Cancel
                    </button>
                  </>
                )}
                {recordingState === "recording" && (
                  <button onClick={stopRecording} style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "12px 24px", background: "#1e1a12", color: "#fff",
                    border: "none", borderRadius: 3, fontSize: 11, letterSpacing: "0.15em",
                    textTransform: "uppercase" as const, cursor: "pointer",
                  }}>
                    <Square size={14} /> Stop Recording
                  </button>
                )}
              </div>
            </div>
          )}

          {recordingState === "recorded" && (
            <div>
              <div style={{
                borderRadius: 6, overflow: "hidden", background: "#000",
                marginBottom: 16, aspectRatio: "16/9",
              }}>
                <video
                  ref={videoPlaybackRef}
                  controls
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                <button onClick={uploadRecording} style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 24px", background: "#c8416a", color: "#fff",
                  border: "none", borderRadius: 3, fontSize: 11, letterSpacing: "0.15em",
                  textTransform: "uppercase" as const, cursor: "pointer",
                }}>
                  <Upload size={14} /> Use This Video
                </button>
                <button onClick={discardRecording} style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 24px", background: "transparent", color: "#8a7f6e",
                  border: "1px solid rgba(55,45,25,0.15)", borderRadius: 3,
                  fontSize: 11, letterSpacing: "0.15em",
                  textTransform: "uppercase" as const, cursor: "pointer",
                }}>
                  Re-record
                </button>
              </div>
            </div>
          )}

          {recordingState === "uploading" && (
            <div>
              <div style={{
                position: "relative", borderRadius: 6, overflow: "hidden",
                background: "#000", marginBottom: 16, aspectRatio: "16/9",
              }}>
                <video
                  ref={videoPlaybackRef}
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
                }}>
                  <Loader2 size={28} style={{ color: "#fff", animation: "spin 1s linear infinite" }} />
                  <p style={{ fontSize: 13, color: "#fff" }}>Uploading and processing your video...</p>
                </div>
              </div>
            </div>
          )}

          <style>{`
            @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
            @keyframes spin { to { transform: rotate(360deg) } }
          `}</style>
        </div>

        {/* Upload Homework */}
        <div style={{
          padding: "32px 28px", background: "#f8f3e8", border: "1px solid rgba(55,45,25,0.10)",
          borderRadius: 4, marginBottom: 32,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 4, background: "rgba(158,107,117,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Upload size={18} style={{ color: "#c8416a" }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>Upload Homework</div>
              <p style={{ fontSize: 12, color: "#8a7f6e", marginTop: 2 }}>
                Upload a PDF worksheet for your child&apos;s tutoring sessions
              </p>
            </div>
          </div>

          {children.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChild(child)}
                  style={{
                    padding: "8px 16px", borderRadius: 3, fontSize: 12,
                    border: `1.5px solid ${selectedChild?.id === child.id ? "#c8416a" : "rgba(55,45,25,0.10)"}`,
                    background: selectedChild?.id === child.id ? "rgba(158,107,117,0.06)" : "transparent",
                    color: selectedChild?.id === child.id ? "#c8416a" : "#1a1610",
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  {child.name}
                </button>
              ))}
            </div>
          )}

          <label style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px", border: "1.5px dashed rgba(158,107,117,0.22)", borderRadius: 4,
            color: "#c8416a", fontSize: 12, letterSpacing: "0.12em",
            textTransform: "uppercase" as const, cursor: "pointer",
            transition: "background 0.2s",
          }}>
            <FileText size={16} />
            {uploading ? "Uploading..." : "Choose PDF File"}
            <input type="file" accept=".pdf" style={{ display: "none" }} onChange={handleFileUpload} disabled={uploading} />
          </label>

          {documents.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, color: "#8a7f6e", marginBottom: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                Uploaded Files
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {documents.slice(0, 5).map((doc) => (
                  <div key={doc.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    background: "rgba(244,239,229,0.5)", borderRadius: 3,
                    border: "1px solid rgba(55,45,25,0.06)",
                  }}>
                    <FileText size={14} style={{ color: "#c8416a", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name}</div>
                      <div style={{ fontSize: 11, color: "#8a7f6e" }}>{new Date(doc.uploaded_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Session Overview */}
        {sessions.length > 0 && (
          <div style={{
            padding: "32px 28px", background: "#f8f3e8", border: "1px solid rgba(55,45,25,0.10)",
            borderRadius: 4, marginBottom: 32,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 4, background: "rgba(158,107,117,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Clock size={18} style={{ color: "#c8416a" }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>Session History</div>
                <p style={{ fontSize: 12, color: "#8a7f6e", marginTop: 2 }}>
                  {sessions.length} total session{sessions.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sessions.slice(0, 8).map((session) => (
                <div key={session.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", background: "rgba(244,239,229,0.5)",
                  borderRadius: 3, border: "1px solid rgba(55,45,25,0.06)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: session.status === "active" ? "#5c7c6a" : "#afa598",
                    }} />
                    <div>
                      <div style={{ fontSize: 13 }}>
                        {session.status === "active" ? "In Progress" : "Completed"}
                      </div>
                      <div style={{ fontSize: 11, color: "#8a7f6e" }}>
                        {new Date(session.started_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#8a7f6e", fontSize: 12 }}>
                    <Clock size={12} />
                    {session.focus_score_avg != null ? `${Math.round(session.focus_score_avg)}% focus` : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Account Info */}
        <div style={{
          padding: "24px 28px", background: "#f8f3e8", border: "1px solid rgba(55,45,25,0.10)",
          borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "#8a7f6e", marginBottom: 4 }}>
              Account
            </div>
            <div style={{ fontSize: 14 }}>{parent?.name || "Parent"}</div>
            <div style={{ fontSize: 12, color: "#8a7f6e" }}>{parent?.email}</div>
          </div>
          <div style={{ fontSize: 12, color: "#8a7f6e" }}>
            {children.length} child{children.length !== 1 ? "ren" : ""}
          </div>
        </div>
      </main>
    </div>
  );
}
