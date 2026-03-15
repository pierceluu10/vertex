import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, eventType, durationMs } = body;

    const supabase = await createServiceClient();

    const { error } = await supabase.from("focus_events").insert({
      session_id: sessionId,
      event_type: eventType,
      duration_ms: durationMs || null,
    });

    if (error) {
      console.error("Focus event error:", error);
      return NextResponse.json({ error: "Failed to log event" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Focus API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
