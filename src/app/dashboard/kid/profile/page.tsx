"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home,
  User,
  ArrowLeft,
  Trophy,
  Clock,
  Target,
  BookOpen,
  GraduationCap,
  Zap,
} from "lucide-react";
import { VertexLogo } from "@/components/vertex/vertex-logo";
import type { KidSession } from "@/types";
import "@/styles/vertex.css";

const IconMap: Record<string, React.ElementType> = { MdSchool: GraduationCap, MdBolt: Zap };

/* ─── Activity entry ─── */
interface ActivityEntry {
  type: "session" | "quiz" | "badge";
  timestamp: string;
  icon: string;
  description: string;
}

/* ─── Stagger animation ─── */
const stagger = {
  hidden: { opacity: 0 },
  show: (i: number) => ({
    opacity: 1,
    transition: { delay: i * 0.04, duration: 0.28, ease: "easeOut" as const },
  }),
};

type Tab = "home" | "profile";

export default function KidProfilePage() {
  const router = useRouter();
  const [kidSession, setKidSession] = useState<KidSession | null>(null);
  const [mounted, setMounted] = useState(false);

  // Profile data
  const [profileData, setProfileData] = useState<{
    totalSessions: number;
    totalStudyMinutes: number;
    sessionsThisWeek: number;
    sessionDates: string[];
    quizzesTaken: number;
    avgQuizScore: number | null;
    messageCount: number;
  } | null>(null);

  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Read session client-side
  useEffect(() => {
    let session: KidSession | null = null;
    try {
      const raw = window.localStorage.getItem("vertex_kid_session");
      session = raw ? (JSON.parse(raw) as KidSession) : null;
    } catch { /* ignore */ }
    setKidSession(session);
    setMounted(true);
  }, []);

  const loadProfile = useCallback(async (sessionId: string) => {
    try {
      const [profileRes, activityRes] = await Promise.all([
        fetch(`/api/student/profile?kidSessionId=${encodeURIComponent(sessionId)}`),
        fetch(`/api/student/activity?kidSessionId=${encodeURIComponent(sessionId)}`),
      ]);

      const [profileJson, activityJson] = await Promise.all([
        profileRes.json(),
        activityRes.json(),
      ]);

      if (profileJson.kidSession) {
        setKidSession((prev) => prev ? { ...prev, ...profileJson.kidSession } : prev);
      }

      setProfileData({
        totalSessions: profileJson.totalSessions ?? 0,
        totalStudyMinutes: profileJson.totalStudyMinutes ?? 0,
        sessionsThisWeek: profileJson.sessionsThisWeek ?? 0,
        sessionDates: profileJson.sessionDates ?? [],
        quizzesTaken: profileJson.quizzesTaken ?? 0,
        avgQuizScore: profileJson.avgQuizScore ?? null,
        messageCount: profileJson.messageCount ?? 0,
      });

      setActivity(activityJson.entries ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!kidSession) {
      router.push("/student");
      return;
    }
    void loadProfile(kidSession.id);
  }, [mounted, kidSession, loadProfile, router]);

  // Loading state
  if (!mounted || !kidSession) {
    return (
      <div className="vtx-auth-page">
        <p className="vtx-kid-subtitle" style={{ margin: 0 }}>Loading…</p>
      </div>
    );
  }

  const childName = kidSession.child_name?.trim() || "there";

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <Home size={18} /> },
    { id: "profile", label: "Profile", icon: <User size={18} /> },
  ];

  return (
    <div className="vtx-kid-page vtx-kid-ui flex h-screen flex-col overflow-hidden overscroll-none">
      <header className="vtx-kid-header">
        <VertexLogo href="/" height={52} className="vtx-kid-logo" />
      </header>

      <div className="kid-dashboard-scroll flex-1 min-h-0 overflow-y-auto">
        <div className="vtx-kid-scroll-padding">
          <div className="vtx-kid-content">
            {/* Back button */}
            <button type="button" className="vtx-kid-back" onClick={() => router.push("/dashboard/kid")}>
              <ArrowLeft size={16} /> Back to Dashboard
            </button>

            {/* ─── Profile heading ─── */}
            <motion.div
              className="vtx-kid-gp-profile-heading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="vtx-kid-gp-profile-title">Profile</h1>
              <p className="vtx-kid-gp-level-name">{childName}</p>
            </motion.div>

            {/* ─── Stats Row ─── */}
            {!loading && profileData && (
              <motion.div
                className="vtx-kid-gp-stats-row"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <div className="vtx-kid-gp-stat-card">
                  <div className="vtx-kid-gp-stat-icon"><Trophy size={22} /></div>
                  <div className="vtx-kid-gp-stat-value">{profileData.totalSessions}</div>
                  <div className="vtx-kid-gp-stat-label">Sessions</div>
                </div>
                <div className="vtx-kid-gp-stat-card">
                  <div className="vtx-kid-gp-stat-icon"><Clock size={22} /></div>
                  <div className="vtx-kid-gp-stat-value">{profileData.totalStudyMinutes}<span className="vtx-kid-gp-stat-unit">min</span></div>
                  <div className="vtx-kid-gp-stat-label">Study time</div>
                </div>
                <div className="vtx-kid-gp-stat-card">
                  <div className="vtx-kid-gp-stat-icon"><Target size={22} /></div>
                  <div className="vtx-kid-gp-stat-value">{profileData.quizzesTaken}</div>
                  <div className="vtx-kid-gp-stat-label">Quizzes</div>
                </div>
                <div className="vtx-kid-gp-stat-card">
                  <div className="vtx-kid-gp-stat-icon"><BookOpen size={22} /></div>
                  <div className="vtx-kid-gp-stat-value">{profileData.avgQuizScore != null ? `${profileData.avgQuizScore}%` : "—"}</div>
                  <div className="vtx-kid-gp-stat-label">Avg score</div>
                </div>
              </motion.div>
            )}

            {/* ─── Recent Activity ─── */}
            {!loading && (
              <motion.div
                className="vtx-kid-gp-section"
                variants={stagger}
                initial="hidden"
                animate="show"
                custom={9}
              >
                <h2 className="vtx-kid-gp-section-heading">
                  <Zap className="vtx-kid-gp-section-icon" /> Recent Activity
                </h2>
                {activity.length === 0 ? (
                  <div className="vtx-kid-gp-empty">
                    <p>No activity yet. Start a study session to fill this up!</p>
                  </div>
                ) : (
                  <div className="vtx-kid-gp-activity-list">
                    {activity.map((entry, i) => (
                      <motion.div
                        key={`${entry.type}-${entry.timestamp}-${i}`}
                        className="vtx-kid-gp-activity-item"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.25 }}
                      >
                        <span className="vtx-kid-gp-activity-icon">
                          {(() => {
                            const ActivityIcon = IconMap[entry.icon] || Zap;
                            return <ActivityIcon style={{ color: "var(--vtx-pink, #c8416a)" }} />;
                          })()}
                        </span>
                        <div className="vtx-kid-gp-activity-text">
                          <span className="vtx-kid-gp-activity-desc">{entry.description}</span>
                          <span className="vtx-kid-gp-activity-time">
                            {formatRelativeTime(entry.timestamp)}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Spacer for bottom nav */}
            <div style={{ height: 100 }} />
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="vtx-kid-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`vtx-kid-nav-item${item.id === "profile" ? " active" : ""}`}
            onClick={() => {
              if (item.id === "profile") return;
              router.push("/dashboard/kid");
            }}
          >
            {item.id === "profile" && (
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

/* ─── Relative time formatter ─── */
function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
