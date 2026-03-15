import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/focus/timeline
 * Appends focus timeline entries to the sessions table.
 */
export async function POST(request: Request) {
  try {
    const { sessionId, entries } = await request.json();

    if (!sessionId || !entries?.length) {
      return NextResponse.json({ skipped: true });
    }

    const supabase = await createServiceClient();

    // Read existing timeline, append new entries
    const { data: session } = await supabase
      .from("sessions")
      .select("focus_timeline")
      .eq("id", sessionId)
      .single();

    const existing = (session?.focus_timeline as unknown[]) || [];
    const merged = [...existing, ...entries];

    // Also update the focus_score to the latest smoothed value
    const latestScore = entries[entries.length - 1]?.score ?? null;

    const updatePayload: Record<string, unknown> = { focus_timeline: merged };
    if (latestScore !== null) updatePayload.focus_score = Math.round(latestScore);

    const { error } = await supabase
      .from("sessions")
      .update(updatePayload)
      .eq("id", sessionId);

    if (error) {
      console.error("Focus timeline save error:", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ saved: entries.length });
  } catch (error) {
    console.error("Focus timeline API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
