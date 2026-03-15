import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface ActivityEntry {
  type: "session" | "quiz" | "badge";
  timestamp: string;
  icon: string;
  description: string;
}

/** GET: recent activity feed for a kid session. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kidSessionId = searchParams.get("kidSessionId");

    if (!kidSessionId) {
      return NextResponse.json({ error: "Missing kidSessionId" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const entries: ActivityEntry[] = [];

    // Completed sessions
    const { data: sessions } = await supabase
      .from("tutoring_sessions")
      .select("id, status, started_at, ended_at, focus_score_avg")
      .eq("kid_session_id", kidSessionId)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(20);

    for (const s of sessions ?? []) {
      const duration = s.started_at && s.ended_at
        ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)
        : null;
      const focusPart = s.focus_score_avg != null ? ` — ${Math.round(s.focus_score_avg)}% focus` : "";
      const durationPart = duration != null ? `${duration} min session` : "Study session";
      entries.push({
        type: "session",
        timestamp: s.ended_at || s.started_at,
        icon: "📚",
        description: `Completed a ${durationPart}${focusPart}`,
      });
    }

    // Quizzes
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("id, questions, score, taken_at")
      .eq("kid_session_id", kidSessionId)
      .order("taken_at", { ascending: false })
      .limit(20);

    for (const q of quizzes ?? []) {
      const questionCount = Array.isArray(q.questions) ? q.questions.length : 0;
      const scorePart = q.score != null ? ` — ${q.score}% score` : "";
      entries.push({
        type: "quiz",
        timestamp: q.taken_at,
        icon: "✨",
        description: `Completed a quiz (${questionCount} questions)${scorePart}`,
      });
    }

    // Badges earned
    const { data: badges } = await supabase
      .from("kid_badges")
      .select("badge_id, earned_at")
      .eq("kid_session_id", kidSessionId)
      .order("earned_at", { ascending: false })
      .limit(20);

    const badgeTitles: Record<string, string> = {
      first_session: "First Session",
      streak_3: "3-Day Streak",
      streak_7: "Weekly Warrior",
      streak_30: "Monthly Master",
      first_quiz: "Quiz Starter",
      perfect_quiz: "Perfect Score",
      questions_10: "Curious Mind",
      night_owl: "Night Owl",
      speed_demon: "Speed Demon",
    };

    for (const b of badges ?? []) {
      entries.push({
        type: "badge",
        timestamp: b.earned_at,
        icon: "🏆",
        description: `Earned the "${badgeTitles[b.badge_id] || b.badge_id}" badge`,
      });
    }

    // Sort by timestamp descending
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ entries: entries.slice(0, 30) });
  } catch (e) {
    console.error("GET /api/student/activity error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
