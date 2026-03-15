import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** GET: aggregated profile stats for a kid session. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kidSessionId = searchParams.get("kidSessionId");

    if (!kidSessionId) {
      return NextResponse.json({ error: "Missing kidSessionId" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Fetch kid session (XP, streak)
    const { data: kidSession } = await supabase
      .from("kids_sessions")
      .select("id, xp_points, streak_count, last_active_date, child_name, created_at")
      .eq("id", kidSessionId)
      .single();

    if (!kidSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch tutoring sessions
    const { data: sessions } = await supabase
      .from("tutoring_sessions")
      .select("id, status, started_at, ended_at, focus_score_avg")
      .eq("kid_session_id", kidSessionId)
      .order("started_at", { ascending: false });

    const allSessions = sessions ?? [];
    const completedSessions = allSessions.filter((s) => s.status === "completed");

    // Total study time in minutes
    const totalStudyMinutes = completedSessions.reduce((acc, s) => {
      if (s.started_at && s.ended_at) {
        return acc + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
      }
      return acc;
    }, 0);

    // Sessions this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const sessionsThisWeek = allSessions.filter(
      (s) => new Date(s.started_at) >= weekAgo
    ).length;

    // Session dates for calendar (unique dates)
    const sessionDates = [...new Set(
      allSessions.map((s) => new Date(s.started_at).toISOString().split("T")[0])
    )];

    // Fetch quizzes
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("id, questions, answers, score, taken_at")
      .eq("kid_session_id", kidSessionId)
      .order("taken_at", { ascending: false });

    const allQuizzes = quizzes ?? [];
    const scoredQuizzes = allQuizzes.filter((q) => q.score != null);
    const avgQuizScore = scoredQuizzes.length > 0
      ? Math.round(scoredQuizzes.reduce((a, q) => a + (q.score ?? 0), 0) / scoredQuizzes.length)
      : null;

    // Count messages sent by user (for badge checking)
    const { count: messageCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .in(
        "session_id",
        allSessions.map((s) => s.id)
      );

    return NextResponse.json({
      kidSession,
      totalSessions: completedSessions.length,
      totalStudyMinutes: Math.round(totalStudyMinutes),
      sessionsThisWeek,
      sessionDates,
      quizzesTaken: allQuizzes.length,
      avgQuizScore,
      messageCount: messageCount ?? 0,
    });
  } catch (e) {
    console.error("GET /api/student/profile error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
