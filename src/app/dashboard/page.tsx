"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Play, FileText, Clock, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Child, UploadedDocument, TutoringSession } from "@/types";
import "@/styles/vertex.css";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [children, setChildren] = useState<Child[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [sessions, setSessions] = useState<TutoringSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [childrenRes, docsRes, sessionsRes] = await Promise.all([
      supabase.from("children").select("*").eq("parent_id", user.id),
      supabase.from("uploaded_documents").select("*").eq("parent_id", user.id).order("uploaded_at", { ascending: false }),
      supabase.from("tutoring_sessions").select("*").order("started_at", { ascending: false }).limit(10),
    ]);

    if (childrenRes.data) {
      setChildren(childrenRes.data);
      if (childrenRes.data.length > 0 && !selectedChild) {
        setSelectedChild(childrenRes.data[0]);
      }
    }
    if (docsRes.data) setDocuments(docsRes.data);
    if (sessionsRes.data) setSessions(sessionsRes.data);
    setLoading(false);
  }, [supabase, router, selectedChild]);

  useEffect(() => { loadData(); }, [loadData]);

  async function startSession(documentId?: string) {
    if (!selectedChild) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: session } = await supabase
      .from("tutoring_sessions")
      .insert({
        child_id: selectedChild.id,
        document_id: documentId || null,
        status: "active",
      })
      .select()
      .single();

    if (session) router.push(`/session/${session.id}`);
  }

  if (loading) {
    return (
      <div className="vtx-auth-page">
        <p style={{ color: "#8a7f6e", fontSize: 13 }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{
      height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column",
      background: "#f4efe5", fontFamily: "'Calibri', 'Trebuchet MS', sans-serif", color: "#1e1a12",
    }}>
      <header style={{
        flexShrink: 0, borderBottom: "1px solid rgba(55,45,25,0.10)",
        padding: "20px 48px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(248,243,232,0.95)",
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" as const }}>
          Vertex
        </div>
        <button
          onClick={() => router.push("/parent")}
          style={{
            display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "1px solid rgba(55,45,25,0.10)", borderRadius: 3, padding: "8px 16px",
            color: "#8a7f6e", fontSize: 10, letterSpacing: "0.18em",
            textTransform: "uppercase" as const, cursor: "pointer",
          }}
        >
          <Settings size={14} /> Parent
        </button>
      </header>

      <main style={{ flex: 1, overflowY: "auto", maxWidth: 960, margin: "0 auto", padding: "40px 24px" }}>
        {children.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                style={{
                  padding: "10px 20px", borderRadius: 3, fontSize: 13,
                  border: `1.5px solid ${selectedChild?.id === child.id ? "#c8416a" : "rgba(55,45,25,0.10)"}`,
                  background: selectedChild?.id === child.id ? "rgba(200,65,106,0.06)" : "transparent",
                  color: selectedChild?.id === child.id ? "#c8416a" : "#1a1610",
                  cursor: "pointer", transition: "all 0.2s",
                }}
              >
                {child.name}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 48 }}>
          <div style={{
            padding: "32px 28px", background: "#f8f3e8", border: "1px solid rgba(55,45,25,0.10)",
            borderRadius: 4,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 4, background: "rgba(200,65,106,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
            }}>
              <Play size={18} style={{ color: "#c8416a" }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Start Session</div>
            <p style={{ fontSize: 12, color: "#8a7f6e", marginBottom: 16, lineHeight: 1.6 }}>
              Begin a new tutoring session{selectedChild ? ` for ${selectedChild.name}` : ""}
            </p>
            <button onClick={() => startSession()} style={{
              width: "100%", padding: "12px", background: "#c8416a", color: "#fff",
              border: "none", borderRadius: 3, fontSize: 11, letterSpacing: "0.18em",
              textTransform: "uppercase" as const, cursor: "pointer",
            }}>
              Start Now
            </button>
          </div>

          <div style={{
            padding: "32px 28px", background: "#f8f3e8", border: "1px solid rgba(55,45,25,0.10)",
            borderRadius: 4,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 4, background: "rgba(200,65,106,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
            }}>
              <Clock size={18} style={{ color: "#c8416a" }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Progress</div>
            <p style={{ fontSize: 12, color: "#8a7f6e", marginBottom: 16, lineHeight: 1.6 }}>
              {sessions.length} session{sessions.length !== 1 ? "s" : ""} completed so far
            </p>
            <div style={{ fontSize: 36, fontWeight: 300, color: "#c8416a", textAlign: "center" }}>
              {sessions.length}
            </div>
          </div>
        </div>

        {/* Homework Documents */}
        {documents.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>My Homework</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {documents.map((doc) => (
                <div key={doc.id} style={{
                  background: "#f8f3e8", border: "1px solid rgba(55,45,25,0.08)",
                  borderRadius: 4, padding: "16px 20px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <FileText size={18} style={{ color: "#c8416a" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 400 }}>{doc.file_name}</div>
                      <div style={{ fontSize: 11, color: "#8a7f6e" }}>
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => startSession(doc.id)} style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "8px 14px",
                    background: "#c8416a", color: "#fff", border: "none", borderRadius: 3,
                    fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase" as const,
                    cursor: "pointer",
                  }}>
                    <Play size={10} /> Study
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Sessions */}
        {sessions.length > 0 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>Recent Sessions</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sessions.slice(0, 5).map((session) => (
                <div key={session.id} style={{
                  background: "#f8f3e8", border: "1px solid rgba(55,45,25,0.08)",
                  borderRadius: 4, padding: "14px 20px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
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
      </main>
    </div>
  );
}
