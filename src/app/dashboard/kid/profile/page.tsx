"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  MessageCircle,
  User,
  ArrowLeft,
  Trophy,
  Clock,
  Target,
  BookOpen,
  Flame,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VertexLogo } from "@/components/vertex/vertex-logo";
import type { KidSession, KidBadge } from "@/types";
import "@/styles/vertex.css";

/* ─── Level system constants ─── */
const LEVEL_THRESHOLDS = [
  0, 50, 120, 220, 350, 520, 730, 1000, 1350, 1800,
  2350, 3000, 3800, 4800, 6000, 7500, 9500, 12000, 15000, 20000,
];

const LEVEL_TITLES: Record<number, string> = {
  1: "Math Rookie",
  2: "Number Newbie",
  3: "Problem Solver",
  4: "Quick Thinker",
  5: "Number Ninja",
  6: "Math Maverick",
  7: "Brain Builder",
  8: "Equation Expert",
  9: "Logic Lord",
  10: "Algebra Ace",
  11: "Geometry Guru",
  12: "Fraction Fighter",
  13: "Data Dragon",
  14: "Proof Prodigy",
  15: "Calculus Cadet",
  16: "Math Magician",
  17: "Theorem Titan",
  18: "Infinity Explorer",
  19: "Math Mastermind",
  20: "Legendary Scholar",
};

function getLevel(xp: number): { level: number; title: string; xpInLevel: number; xpForNext: number } {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  const xpBase = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const xpNext = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 5000;
  return {
    level,
    title: LEVEL_TITLES[level] ?? "Legendary Scholar",
    xpInLevel: xp - xpBase,
    xpForNext: xpNext - xpBase,
  };
}

/* ─── Badge shape (from API) ─── */
interface BadgeDefinition {
  id: string;
  title: string;
  icon: string;
  description: string;
}

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

type Tab = "home" | "study" | "profile";

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

  const [badgeDefinitions, setBadgeDefinitions] = useState<BadgeDefinition[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<KidBadge[]>([]);
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
      const [profileRes, badgesRes, activityRes] = await Promise.all([
        fetch(`/api/student/profile?kidSessionId=${encodeURIComponent(sessionId)}`),
        fetch("/api/student/badges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kidSessionId: sessionId }),
        }),
        fetch(`/api/student/activity?kidSessionId=${encodeURIComponent(sessionId)}`),
      ]);

      const [profileJson, badgesJson, activityJson] = await Promise.all([
        profileRes.json(),
        badgesRes.json(),
        activityRes.json(),
      ]);

      if (profileJson.kidSession) {
        // Update the stored session with latest XP/streak from server
        setKidSession((prev) => prev ? { ...prev, xp_points: profileJson.kidSession.xp_points, streak_count: profileJson.kidSession.streak_count } : prev);
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

      setBadgeDefinitions(badgesJson.definitions ?? []);
      setEarnedBadges(badgesJson.earned ?? []);
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
  const xp = kidSession.xp_points ?? 0;
  const streak = kidSession.streak_count ?? 0;
  const levelInfo = getLevel(xp);
  const xpPercent = levelInfo.xpForNext > 0
    ? Math.min((levelInfo.xpInLevel / levelInfo.xpForNext) * 100, 100)
    : 100;

  const earnedIds = new Set(earnedBadges.map((b) => b.badge_id));

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "study", label: "Study", icon: <MessageCircle size={18} /> },
    { id: "home", label: "Home", icon: <Home size={18} /> },
    { id: "profile", label: "Profile", icon: <User size={18} /> },
  ];

  return (
    <div className="vtx-kid-page vtx-kid-ui flex h-screen flex-col overflow-hidden">
      <header className="vtx-kid-header">
        <VertexLogo href="/" height={52} className="vtx-kid-logo" />
      </header>

      <ScrollArea className="kid-dashboard-scroll flex-1 [&_[data-slot=scroll-area-scrollbar]]:hidden">
        <div className="vtx-kid-scroll-padding">
          <div className="vtx-kid-content">
            {/* Back button */}
            <button type="button" className="vtx-kid-back" onClick={() => router.push("/dashboard/kid")}>
              <ArrowLeft size={16} /> Back to Dashboard
            </button>

            {/* ─── Level & XP Hero ─── */}
            <motion.div
              className="vtx-kid-gp-level-hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="vtx-kid-gp-level-badge">
                <span className="vtx-kid-gp-level-number">{levelInfo.level}</span>
              </div>
              <h1 className="vtx-kid-gp-level-title">{levelInfo.title}</h1>
              <p className="vtx-kid-gp-level-name">{childName}</p>

              <div className="vtx-kid-gp-xp-bar-wrap">
                <div className="vtx-kid-gp-xp-labels">
                  <span>{xp.toLocaleString()} XP</span>
                  <span>Level {levelInfo.level + 1}</span>
                </div>
                <div className="vtx-kid-gp-xp-track">
                  <motion.div
                    className="vtx-kid-gp-xp-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${xpPercent}%` }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                  />
                </div>
                <div className="vtx-kid-gp-xp-subtitle">
                  {levelInfo.xpInLevel} / {levelInfo.xpForNext} XP to next level
                </div>
              </div>
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
                <div className="vtx-kid-gp-stat-card">
                  <div className="vtx-kid-gp-stat-icon"><Flame size={22} /></div>
                  <div className="vtx-kid-gp-stat-value">{streak}</div>
                  <div className="vtx-kid-gp-stat-label">Day streak</div>
                </div>
              </motion.div>
            )}

            {/* ─── Streak Calendar ─── */}
            {!loading && profileData && (
              <motion.div
                className="vtx-kid-gp-section"
                variants={stagger}
                initial="hidden"
                animate="show"
                custom={5}
              >
                <h2 className="vtx-kid-gp-section-heading">
                  <span className="vtx-kid-gp-section-icon">📅</span> Study Calendar
                </h2>
                <StreakCalendar sessionDates={profileData.sessionDates} />
              </motion.div>
            )}

            {/* ─── Badges ─── */}
            {!loading && (
              <motion.div
                className="vtx-kid-gp-section"
                variants={stagger}
                initial="hidden"
                animate="show"
                custom={7}
              >
                <h2 className="vtx-kid-gp-section-heading">
                  <span className="vtx-kid-gp-section-icon">🏅</span> Badges
                  <span className="vtx-kid-gp-badge-count">{earnedBadges.length}/{badgeDefinitions.length}</span>
                </h2>
                <div className="vtx-kid-gp-badges-grid">
                  {badgeDefinitions.map((badge) => {
                    const isEarned = earnedIds.has(badge.id);
                    return (
                      <div
                        key={badge.id}
                        className={cn("vtx-kid-gp-badge-card", isEarned && "earned")}
                      >
                        <div className="vtx-kid-gp-badge-icon-wrap">
                          <span className="vtx-kid-gp-badge-emoji">{badge.icon}</span>
                          {isEarned && <div className="vtx-kid-gp-badge-shine" />}
                        </div>
                        <div className="vtx-kid-gp-badge-title">{badge.title}</div>
                        <div className="vtx-kid-gp-badge-desc">{badge.description}</div>
                        {isEarned && (
                          <div className="vtx-kid-gp-badge-earned-tag">Unlocked!</div>
                        )}
                      </div>
                    );
                  })}
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
                  <span className="vtx-kid-gp-section-icon">⚡</span> Recent Activity
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
                        <span className="vtx-kid-gp-activity-icon">{entry.icon}</span>
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
      </ScrollArea>

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

/* ─── Streak Calendar Component ─── */
function StreakCalendar({ sessionDates }: { sessionDates: string[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = today.getDate();

  const dateSet = new Set(sessionDates);
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="vtx-kid-gp-calendar">
      <div className="vtx-kid-gp-calendar-header">{monthNames[month]} {year}</div>
      <div className="vtx-kid-gp-calendar-grid">
        {dayLabels.map((d, i) => (
          <div key={`label-${i}`} className="vtx-kid-gp-cal-label">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="vtx-kid-gp-cal-empty" />;
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isStudied = dateSet.has(dateStr);
          const isToday = day === todayDate;
          return (
            <div
              key={dateStr}
              className={cn(
                "vtx-kid-gp-cal-day",
                isStudied && "studied",
                isToday && "today"
              )}
            >
              <span>{day}</span>
              {isStudied && <div className="vtx-kid-gp-cal-stamp" />}
            </div>
          );
        })}
      </div>
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
