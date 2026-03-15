import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Badge definitions — all possible badges a kid can earn. */
export const BADGE_DEFINITIONS = [
  { id: "first_session", title: "First Session", icon: "MdSchool", description: "Complete your first study session" },
  { id: "streak_3", title: "3-Day Streak", icon: "MdLocalFireDepartment", description: "Study 3 days in a row" },
  { id: "streak_7", title: "Weekly Warrior", icon: "MdShield", description: "Study 7 days in a row" },
  { id: "streak_30", title: "Monthly Master", icon: "MdEmojiEvents", description: "Study 30 days in a row" },
  { id: "first_quiz", title: "Quiz Starter", icon: "MdAssignment", description: "Complete your first quiz" },
  { id: "perfect_quiz", title: "Perfect Score", icon: "MdWorkspacePremium", description: "Get 100% on a quiz" },
  { id: "questions_10", title: "Curious Mind", icon: "MdPsychology", description: "Ask 10 questions to your tutor" },
  { id: "night_owl", title: "Night Owl", icon: "MdNightsStay", description: "Study after 8pm" },
  { id: "speed_demon", title: "Speed Demon", icon: "MdBolt", description: "Finish a quiz in under 2 minutes" },
] as const;

/** GET: return earned badges for a kid session. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kidSessionId = searchParams.get("kidSessionId");

    if (!kidSessionId) {
      return NextResponse.json({ error: "Missing kidSessionId" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data: earned } = await supabase
      .from("kid_badges")
      .select("*")
      .eq("kid_session_id", kidSessionId);

    return NextResponse.json({
      definitions: BADGE_DEFINITIONS,
      earned: earned ?? [],
    });
  } catch (e) {
    console.error("GET /api/student/badges error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/** POST: check and award badges based on current progress. */
export async function POST(request: Request) {
  try {
    const { kidSessionId } = await request.json();

    if (!kidSessionId) {
      return NextResponse.json({ error: "Missing kidSessionId" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Load kid session
    const { data: kidSession } = await supabase
      .from("kids_sessions")
      .select("id, streak_count")
      .eq("id", kidSessionId)
      .single();

    if (!kidSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Load tutoring sessions
    const { data: sessions } = await supabase
      .from("tutoring_sessions")
      .select("id, status, started_at, ended_at")
      .eq("kid_session_id", kidSessionId);

    const allSessions = sessions ?? [];
    const completedSessions = allSessions.filter((s) => s.status === "completed");

    // Load quizzes
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("id, questions, score, taken_at")
      .eq("kid_session_id", kidSessionId);

    const allQuizzes = quizzes ?? [];

    // Count user messages
    const { count: messageCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .in("session_id", allSessions.map((s) => s.id));

    // Determine which badges should be earned
    const newBadges: string[] = [];

    // First Session
    if (completedSessions.length >= 1) newBadges.push("first_session");

    // Streak badges
    if (kidSession.streak_count >= 3) newBadges.push("streak_3");
    if (kidSession.streak_count >= 7) newBadges.push("streak_7");
    if (kidSession.streak_count >= 30) newBadges.push("streak_30");

    // Quiz badges
    if (allQuizzes.length >= 1) newBadges.push("first_quiz");

    // Perfect quiz (score of 100 or all questions correct)
    const hasPerfect = allQuizzes.some((q) => {
      if (q.score === 100) return true;
      // Check if questions array matches score
      if (q.questions && Array.isArray(q.questions) && q.score != null) {
        return q.score >= 100;
      }
      return false;
    });
    if (hasPerfect) newBadges.push("perfect_quiz");

    // Curious Mind: 10+ messages
    if ((messageCount ?? 0) >= 10) newBadges.push("questions_10");

    // Night Owl: any session started after 8pm
    const hasNightSession = allSessions.some((s) => {
      const hour = new Date(s.started_at).getHours();
      return hour >= 20;
    });
    if (hasNightSession) newBadges.push("night_owl");

    // Speed Demon: quiz finished under 2 minutes
    // We approximate by checking quizzes with taken_at timestamps
    // Since we don't have a start time for quizzes, we check session-to-quiz timing
    const hasSpeedQuiz = allQuizzes.some((q) => {
      if (!q.taken_at) return false;
      // Find a session that was started within 2 minutes before the quiz was taken
      return allSessions.some((s) => {
        if (!s.started_at) return false;
        const sessionStart = new Date(s.started_at).getTime();
        const quizEnd = new Date(q.taken_at).getTime();
        const diff = quizEnd - sessionStart;
        return diff > 0 && diff < 2 * 60 * 1000;
      });
    });
    if (hasSpeedQuiz) newBadges.push("speed_demon");

    // Upsert badges (ignore conflicts)
    if (newBadges.length > 0) {
      await supabase.from("kid_badges").upsert(
        newBadges.map((badgeId) => ({
          kid_session_id: kidSessionId,
          badge_id: badgeId,
        })),
        { onConflict: "kid_session_id,badge_id", ignoreDuplicates: true }
      );
    }

    // Return full earned list
    const { data: earned } = await supabase
      .from("kid_badges")
      .select("*")
      .eq("kid_session_id", kidSessionId);

    return NextResponse.json({
      definitions: BADGE_DEFINITIONS,
      earned: earned ?? [],
      newlyEarned: newBadges,
    });
  } catch (e) {
    console.error("POST /api/student/badges error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
