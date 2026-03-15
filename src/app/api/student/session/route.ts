import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { kidSessionId, parentId, documentId } = await request.json();

    if (!kidSessionId) {
      return NextResponse.json({ error: "Missing kidSessionId" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: session, error } = await supabase
      .from("tutoring_sessions")
      .insert({
        kid_session_id: kidSessionId,
        document_id: documentId || null,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("Session creation error:", error);
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    let documentContext = null;
    let parentName: string | null = null;
    let parentAvatarId: string | null = null;
    if (documentId) {
      const { data: doc } = await supabase
        .from("uploaded_documents")
        .select("extracted_text")
        .eq("id", documentId)
        .single();
      if (doc?.extracted_text) {
        documentContext = doc.extracted_text.slice(0, 4000);
      }
    }

    if (parentId) {
      const { data: parent } = await supabase
        .from("parents")
        .select("name, heygen_avatar_id")
        .eq("id", parentId)
        .maybeSingle();

      if (parent) {
        parentName = parent.name;
        parentAvatarId = parent.heygen_avatar_id;
      }
    }

    return NextResponse.json({
      sessionId: session.id,
      documentContext,
      parentName,
      parentAvatarId,
    });
  } catch (error) {
    console.error("Student session error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** Compute focus score from logged events (server-authoritative when events exist). */
function computeFocusScoreFromEvents(events: { event_type: string; duration_ms?: number | null }[]): number {
  let score = 100;
  for (const e of events) {
    switch (e.event_type) {
      case "tab_blur":
        score -= 15;
        if (e.duration_ms && e.duration_ms > 60_000) score -= 10;
        break;
      case "face_absent":
        score -= 8;
        break;
      case "inactive":
        score -= 10;
        break;
      case "no_response":
        score -= 5;
        break;
      default:
        score -= 5;
    }
  }
  return Math.max(0, Math.min(100, score));
}

export async function PATCH(request: Request) {
  try {
    const { sessionId, focusScore: clientFocusScore } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    let focusScoreToStore = clientFocusScore != null ? Number(clientFocusScore) : null;

    const { data: focusEvents } = await supabase
      .from("focus_events")
      .select("event_type, duration_ms")
      .eq("session_id", sessionId);

    if (focusEvents && focusEvents.length > 0) {
      const serverComputed = computeFocusScoreFromEvents(focusEvents);
      focusScoreToStore = serverComputed;
    }

    await supabase
      .from("tutoring_sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        focus_score_avg: focusScoreToStore,
      })
      .eq("id", sessionId);

    // Try to generate a report
    try {
      await fetch(new URL("/api/report", request.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch { /* non-blocking */ }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session PATCH error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
