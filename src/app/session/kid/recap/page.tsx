"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Target, MessageCircle, ArrowRight, Home, Zap,
  Trophy, CheckCircle, XCircle, Flame, Clock, HelpCircle,
} from "lucide-react";
import { MdAutoGraph, MdSchool, MdLock } from "react-icons/md";
import "@/styles/vertex.css";

/* ─── Level titles ─── */
const LEVEL_TITLES: Record<number, string> = {
  1: "Math Rookie", 2: "Number Seeker", 3: "Problem Solver", 4: "Quick Thinker",
  5: "Number Ninja", 6: "Equation Explorer", 7: "Pattern Master", 8: "Logic Wizard",
  9: "Math Maverick", 10: "Algebra Ace", 11: "Geometry Genius", 12: "Calculus Champion",
};
const XP_PER_LEVEL = 500;

function getLevelFromXP(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInLevel = xp % XP_PER_LEVEL;
  return { level, xpInLevel, xpForNext: XP_PER_LEVEL, title: LEVEL_TITLES[Math.min(level, 12)] || "Math Legend" };
}

/* ─── Confetti particles ─── */
function ConfettiEffect() {
  const colors = ["#c8416a", "#f59e0b", "#5a9e76", "#3b82f6", "#8b5cf6", "#ec4899"];
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50 }}>
      {Array.from({ length: 40 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 1, y: -20, x: `${Math.random() * 100}vw`, rotate: 0 }}
          animate={{ opacity: 0, y: "100vh", rotate: Math.random() * 720 - 360 }}
          transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 0.5, ease: "easeOut" }}
          style={{
            position: "absolute",
            width: 8 + Math.random() * 8,
            height: 8 + Math.random() * 8,
            background: colors[i % colors.length],
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Animated counter ─── */
function AnimatedNumber({ target, duration = 1.5 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (target <= 0) return;
    const steps = 30;
    const inc = target / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setCurrent(Math.min(Math.round(inc * step), target));
      if (step >= steps) clearInterval(interval);
    }, (duration * 1000) / steps);
    return () => clearInterval(interval);
  }, [target, duration]);
  return <>{current}</>;
}

function RecapContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sessionId = searchParams.get("sessionId") || "";
  const kidSessionId = searchParams.get("kidSessionId") || "";
  const score = parseInt(searchParams.get("score") || "75", 10);
  const messageCount = parseInt(searchParams.get("messages") || "0", 10);

  // Simulated session data (these would come from a fetch in production)
  const xpEarned = Math.round(score * 2.5 + messageCount * 3);
  const totalXP = 1250 + xpEarned; // Pretend existing XP
  const { level, xpInLevel, xpForNext, title } = getLevelFromXP(totalXP);
  const prevLevel = getLevelFromXP(totalXP - xpEarned);
  const leveledUp = level > prevLevel.level;

  const [showConfetti, setShowConfetti] = useState(true);
  const [weakHints, setWeakHints] = useState<Record<string, string>>({});

  // Mock topic data (in production, fetch from /api/insights/mastery)
  const strongTopics = score >= 60 ? ["Addition", "Multiplication"] : [];
  const weakTopics = score < 80 ? ["Fractions", "Word Problems"] : [];

  // Fetch GPT hints for weak topics
  const fetchHints = useCallback(async () => {
    if (weakTopics.length === 0 || !sessionId) return;
    try {
      const res = await fetch("/api/recap/hints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, weakTopics }),
      });
      const data = await res.json();
      if (data.hints) setWeakHints(data.hints);
    } catch { /* ignore */ }
  }, [sessionId, weakTopics.length]);

  useEffect(() => { fetchHints(); }, [fetchHints]);
  useEffect(() => { setTimeout(() => setShowConfetti(false), 4000); }, []);

  const focusDot = score >= 80 ? "#5a9e76" : score >= 50 ? "#c89020" : "#c8416a";
  const focusSummary = score >= 80 ? "Amazing focus today! You were locked in." :
    score >= 50 ? "Good effort! You stayed mostly on track." :
    "Hey, everyone has off days. Tomorrow will be great!";

  const streakDays = 3; // Would come from Supabase
  const hintsRequested = 2;
  const questionsAsked = messageCount;

  return (
    <div style={{
      minHeight: "100vh", background: "#fef7ee",
      fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
      color: "#1a1610", padding: "40px 24px",
      display: "flex", flexDirection: "column", alignItems: "center",
      maxWidth: 560, margin: "0 auto",
    }}>
      {showConfetti && <ConfettiEffect />}

      {/* Header */}
      <motion.h1
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        style={{ fontSize: 32, fontWeight: 300, marginBottom: 4, textAlign: "center" }}
      >
        Session <em style={{ fontWeight: 600 }}>Complete!</em>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ fontSize: 13, color: "#8a7f6e", marginBottom: 32 }}
      >
        Great work today
      </motion.p>

      {/* XP & Level */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        style={{
          width: "100%", padding: 24, background: "transparent",
          borderRadius: 16, border: "2px dashed rgba(0,0,0,0.08)",
          marginBottom: 20, textAlign: "center",
        }}
      >
        {leveledUp && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ delay: 0.5, duration: 0.6 }}
            style={{
              display: "inline-block", padding: "6px 16px",
              background: "#c8416a",
              borderRadius: 20, color: "#fff", fontSize: 13, fontWeight: 700,
              marginBottom: 12,
            }}
          >
            LEVEL UP!
          </motion.div>
        )}
        <div style={{ fontSize: 14, color: "#8a7f6e", marginBottom: 4 }}>Level {level}</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: "#c8416a", marginBottom: 12 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 8 }}>
          <Zap size={18} style={{ color: "#f59e0b" }} />
          <span style={{ fontSize: 28, fontWeight: 300 }}>+<AnimatedNumber target={xpEarned} /></span>
          <span style={{ fontSize: 13, color: "#8a7f6e" }}>XP earned</span>
        </div>
        <div style={{ height: 8, background: "rgba(0,0,0,0.04)", borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(xpInLevel / xpForNext) * 100}%` }}
            transition={{ delay: 1, duration: 1, ease: "easeOut" }}
            style={{
              height: "100%", borderRadius: 4,
              background: "#f59e0b",
            }}
          />
        </div>
        <div style={{ fontSize: 11, color: "#8a7f6e" }}>{xpInLevel} / {xpForNext} XP to next level</div>
      </motion.div>

      {/* Behaviour Summary */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, width: "100%", marginBottom: 20 }}
      >
        {/* Focus */}
        <div style={{ padding: 16, background: "transparent", borderRadius: 12, border: "2px dashed rgba(0,0,0,0.08)", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: focusDot }} />
            <Target size={16} style={{ color: focusDot }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: focusDot }}>{score}%</div>
          <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 4, fontWeight: 600, textTransform: "uppercase" }}>Focus</div>
        </div>
        {/* Effort */}
        <div style={{ padding: 16, background: "transparent", borderRadius: 12, border: "2px dashed rgba(0,0,0,0.08)", textAlign: "center" }}>
          <HelpCircle size={16} style={{ color: "#3b82f6", marginBottom: 8 }} />
          <div style={{ fontSize: 24, fontWeight: 600, color: "#3b82f6" }}>{questionsAsked}</div>
          <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 4, fontWeight: 600, textTransform: "uppercase" }}>Questions</div>
        </div>
        {/* Streak */}
        <div style={{ padding: 16, background: "transparent", borderRadius: 12, border: "2px dashed rgba(0,0,0,0.08)", textAlign: "center" }}>
          <Flame size={16} style={{ color: "#ef4444", marginBottom: 8 }} />
          <div style={{ fontSize: 24, fontWeight: 600, color: "#ef4444" }}>{streakDays}</div>
          <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 4, fontWeight: 600, textTransform: "uppercase" }}>Day streak</div>
        </div>
      </motion.div>

      {/* Focus summary text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        style={{ fontSize: 13, color: "#5c5347", textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}
      >
        {focusSummary}
      </motion.p>

      {/* You Crushed */}
      {strongTopics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          style={{ width: "100%", marginBottom: 20 }}
        >
          <div style={{ fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", color: "#8a7f6e", marginBottom: 10 }}>
            You crushed it
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {strongTopics.map((topic) => (
              <div key={topic} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 16px", background: "rgba(90,158,118,0.08)",
                border: "1px solid rgba(90,158,118,0.15)", borderRadius: 10,
              }}>
                <CheckCircle size={16} style={{ color: "#5a9e76" }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: "#5a9e76" }}>{topic}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Level Up These */}
      {weakTopics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          style={{ width: "100%", marginBottom: 24 }}
        >
          <div style={{ fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", color: "#8a7f6e", marginBottom: 10 }}>
            Level up these
          </div>
          {weakTopics.map((topic) => (
            <div key={topic} style={{
              padding: 14, background: "rgba(139,92,246,0.05)",
              border: "1px solid rgba(139,92,246,0.12)", borderRadius: 10,
              marginBottom: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <MdAutoGraph size={16} style={{ color: "#8b5cf6" }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: "#8b5cf6" }}>{topic}</span>
              </div>
              <p style={{ fontSize: 12, color: "#5c5347", lineHeight: 1.5, margin: 0 }}>
                {weakHints[topic] || `Keep practicing ${topic} — you're getting closer every day!`}
              </p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        style={{ display: "flex", gap: 12, width: "100%" }}
      >
        <motion.button
          onClick={() => router.push("/dashboard/kid")}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 20px", background: "transparent", color: "#5c5347",
            border: "2px solid rgba(0,0,0,0.08)", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Home size={16} /> Go Home
        </motion.button>
        <motion.button
          onClick={() => {
            const params = new URLSearchParams();
            if (kidSessionId) params.set("kidSessionId", kidSessionId);
            router.push(`/session/kid?${params.toString()}`);
          }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 20px", background: "transparent", color: "#c8416a",
            border: "2px solid rgba(200,65,106,0.2)", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          <MessageCircle size={16} /> Ask Tutor Again
        </motion.button>
      </motion.div>
    </div>
  );
}

export default function RecapPage() {
  return (
    <Suspense fallback={<div className="vtx-auth-page"><p style={{ color: "#8a7f6e" }}>Loading recap...</p></div>}>
      <RecapContent />
    </Suspense>
  );
}
