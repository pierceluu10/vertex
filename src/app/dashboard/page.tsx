"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Upload,
  Play,
  FileText,
  Plus,
  LogOut,
  Clock,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Child, UploadedDocument, TutoringSession } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [children, setChildren] = useState<Child[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [sessions, setSessions] = useState<TutoringSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [parentName, setParentName] = useState("");
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const [parentRes, childrenRes, docsRes, sessionsRes] = await Promise.all([
      supabase.from("parents").select("*").eq("id", user.id).single(),
      supabase.from("children").select("*").eq("parent_id", user.id),
      supabase.from("uploaded_documents").select("*").eq("parent_id", user.id).order("uploaded_at", { ascending: false }),
      supabase.from("tutoring_sessions").select("*").order("started_at", { ascending: false }).limit(10),
    ]);

    if (parentRes.data) setParentName(parentRes.data.full_name);
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !selectedChild) return;
    setUploading(true);

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("childId", selectedChild.id);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setUploading(false);
  }

  async function startSession(documentId?: string) {
    if (!selectedChild) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: session } = await supabase
      .from("tutoring_sessions")
      .insert({
        child_id: selectedChild.id,
        document_id: documentId || null,
      })
      .select()
      .single();

    if (session) {
      router.push(`/session/${session.id}`);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-violet-50/40 to-violet-100/30 flex items-center justify-center">
        <div className="animate-pulse text-violet-600 font-medium">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-violet-50/40 to-violet-100/30">
      {/* Header */}
      <header className="border-b border-violet-100/50 bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3L2 20h20L12 3z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-lg">Welcome, {parentName}</h1>
              <p className="text-xs text-muted-foreground">Parent Dashboard</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Children selector */}
        {children.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <p className="text-muted-foreground mb-4">
              No children added yet.
            </p>
            <Button
              onClick={() => router.push("/onboarding")}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Child
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Child selector tabs */}
            {children.length > 1 && (
              <div className="flex gap-2">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChild(child)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedChild?.id === child.id
                        ? "bg-violet-600 text-white shadow-md"
                        : "bg-white/70 text-muted-foreground hover:bg-violet-50"
                    }`}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white/70 backdrop-blur-sm border-violet-100/50 hover:shadow-lg hover:shadow-violet-100/30 transition-all cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-2">
                    <Play className="h-5 w-5 text-violet-600" />
                  </div>
                  <CardTitle className="text-base">Start Session</CardTitle>
                  <CardDescription>
                    Begin a new tutoring session for {selectedChild?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => startSession()}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
                  >
                    Start Now
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-white/70 backdrop-blur-sm border-violet-100/50 hover:shadow-lg hover:shadow-violet-100/30 transition-all">
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center mb-2">
                    <Upload className="h-5 w-5 text-pink-600" />
                  </div>
                  <CardTitle className="text-base">Upload Homework</CardTitle>
                  <CardDescription>
                    Upload a PDF worksheet for grounded tutoring
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <label className="block cursor-pointer">
                    <span className="inline-flex w-full items-center justify-center rounded-xl border border-violet-200 text-violet-700 hover:bg-violet-50 h-8 px-2.5 text-sm font-medium transition-colors">
                      {uploading ? "Uploading..." : "Choose PDF"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                </CardContent>
              </Card>

              <Card className="bg-white/70 backdrop-blur-sm border-violet-100/50 hover:shadow-lg hover:shadow-violet-100/30 transition-all">
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mb-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                  </div>
                  <CardTitle className="text-base">Progress</CardTitle>
                  <CardDescription>
                    {sessions.length} session{sessions.length !== 1 ? "s" : ""}{" "}
                    completed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-violet-600">
                    {sessions.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Uploaded Documents */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Uploaded Homework</h2>
              {documents.length === 0 ? (
                <div className="bg-white/50 rounded-2xl border border-dashed border-violet-200 p-8 text-center">
                  <FileText className="h-8 w-8 text-violet-300 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    No documents uploaded yet. Upload a homework PDF to get started.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {documents.map((doc) => (
                    <motion.div
                      key={doc.id}
                      className="bg-white/70 rounded-xl border border-violet-100/50 p-4 flex items-center justify-between"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-violet-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => startSession(doc.id)}
                        className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Study
                      </Button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Sessions */}
            {sessions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Recent Sessions</h2>
                <div className="space-y-2">
                  {sessions.slice(0, 5).map((session) => (
                    <div
                      key={session.id}
                      className="bg-white/70 rounded-xl border border-violet-100/50 p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${session.status === "active" ? "bg-green-500" : "bg-gray-300"}`} />
                        <div>
                          <p className="text-sm font-medium">
                            {session.status === "active" ? "In Progress" : "Completed"}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(session.started_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {session.focus_score_avg !== null && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Focus: </span>
                          <span className="font-semibold text-violet-600">
                            {Math.round(session.focus_score_avg)}%
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
