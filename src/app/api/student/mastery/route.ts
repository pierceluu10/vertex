import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { computeMasteryDecayFactor } from "@/lib/content-confidence";

/**
 * GET /api/student/mastery?kidSessionId=xxx
 * Returns strengths (>70) and weaknesses (<40 or stale) for the kid home screen.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kidSessionId = searchParams.get("kidSessionId");

    if (!kidSessionId) {
      return NextResponse.json({ strengths: [], weaknesses: [], hasData: false });
    }

    const supabase = await createServiceClient();

    const { data: topics, error } = await supabase
      .from("topic_mastery")
      .select("*")
      .eq("kid_session_id", kidSessionId)
      .order("confidence_score", { ascending: false });

    if (error || !topics?.length) {
      return NextResponse.json({ strengths: [], weaknesses: [], hasData: false });
    }

    const now = new Date();
    const enriched = topics.map((t) => {
      const decay = computeMasteryDecayFactor(
        t.last_active_at ? new Date(t.last_active_at) : null,
        now
      );
      const daysSince = t.last_active_at
        ? Math.floor((now.getTime() - new Date(t.last_active_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        ...t,
        adjustedConfidence: Math.round(t.confidence_score * decay),
        isStale: daysSince > 7,
      };
    });

    const strengths = enriched
      .filter((t) => t.adjustedConfidence > 70)
      .slice(0, 3)
      .map((t) => ({
        topic: t.topic,
        confidence: t.adjustedConfidence,
        label: t.adjustedConfidence >= 90 ? "You're a natural!" : "Killing it!",
        tier: t.adjustedConfidence >= 90 ? "fire" : "star",
      }));

    const weaknesses = enriched
      .filter((t) => t.adjustedConfidence < 40 || t.isStale)
      .sort((a, b) => a.adjustedConfidence - b.adjustedConfidence)
      .slice(0, 3)
      .map((t) => ({
        topic: t.topic,
        confidence: t.adjustedConfidence,
        label: t.adjustedConfidence < 20 ? "Let's level this up!" : "Almost there!",
        isStale: t.isStale,
      }));

    return NextResponse.json({ strengths, weaknesses, hasData: true });
  } catch (error) {
    console.error("Student mastery error:", error);
    return NextResponse.json({ strengths: [], weaknesses: [], hasData: false });
  }
}
