import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/insights/sessions
 * Returns last 5 sessions with focus_timeline, distraction_events, and stats.
 */
export async function GET() {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = await createServiceClient();

    // Get parent's sessions
    const { data: sessions, error } = await supabase
      .from("tutoring_sessions")
      .select("id, started_at, ended_at, status, focus_score_avg, session_summary, kid_session_id, child_id")
      .order("started_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Insights sessions error:", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    if (!sessions?.length) {
      return NextResponse.json({ sessions: [] });
    }

    // Get session details from sessions table (which has focus_timeline, distraction_events)
    const sessionIds = sessions.map((s) => s.id);
    const { data: sessionDetails } = await supabase
      .from("sessions")
      .select("id, focus_score, focus_timeline, distraction_events, study_duration")
      .in("id", sessionIds);

    // Merge
    const merged = sessions.map((s) => {
      const detail = sessionDetails?.find((d) => d.id === s.id);
      return {
        ...s,
        focus_timeline: detail?.focus_timeline || [],
        distraction_events: detail?.distraction_events || [],
        focus_score: detail?.focus_score ?? s.focus_score_avg ?? 0,
        study_duration: detail?.study_duration || null,
      };
    });

    return NextResponse.json({ sessions: merged });
  } catch (error) {
    console.error("Insights sessions API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
