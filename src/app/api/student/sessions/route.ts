import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** GET: list tutoring sessions for a kid (by kid_session_id). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kidSessionId = searchParams.get("kidSessionId");

    if (!kidSessionId) {
      return NextResponse.json({ error: "Missing kidSessionId" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: sessions, error } = await supabase
      .from("tutoring_sessions")
      .select("id, status, started_at, ended_at, focus_score_avg, session_summary")
      .eq("kid_session_id", kidSessionId)
      .order("started_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Sessions fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sessions: sessions ?? [] });
  } catch (e) {
    console.error("GET /api/student/sessions error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
