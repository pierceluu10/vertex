import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { computeMasteryDecayFactor } from "@/lib/content-confidence";

/**
 * GET /api/insights/mastery?kidSessionId=xxx
 * Returns topic_mastery rows with computed decay factor.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kidSessionId = searchParams.get("kidSessionId");

    const supabase = await createServiceClient();

    let query = supabase.from("topic_mastery").select("*").order("confidence_score", { ascending: false });

    if (kidSessionId) {
      query = query.eq("kid_session_id", kidSessionId);
    }

    const { data: topics, error } = await query.limit(50);

    if (error) {
      console.error("Mastery fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    const now = new Date();
    const enriched = (topics || []).map((t) => {
      const decayFactor = computeMasteryDecayFactor(
        t.last_active_at ? new Date(t.last_active_at) : null,
        now
      );
      const daysSinceActive = t.last_active_at
        ? Math.floor((now.getTime() - new Date(t.last_active_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        ...t,
        decayFactor: Math.round(decayFactor * 100) / 100,
        adjustedConfidence: Math.round(t.confidence_score * decayFactor),
        daysSinceActive,
        isStale: daysSinceActive > 7,
      };
    });

    return NextResponse.json({ topics: enriched });
  } catch (error) {
    console.error("Mastery API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
