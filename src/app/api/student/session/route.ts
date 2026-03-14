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

    // Award XP for starting a session
    try {
      const { data: ks } = await supabase
        .from("kids_sessions")
        .select("xp_points")
        .eq("id", kidSessionId)
        .single();
      if (ks) {
        await supabase
          .from("kids_sessions")
          .update({ xp_points: (ks.xp_points || 0) + 5 })
          .eq("id", kidSessionId);
      }
    } catch { /* non-blocking */ }

    return NextResponse.json({
      sessionId: session.id,
      documentContext,
    });
  } catch (error) {
    console.error("Student session error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { sessionId, focusScore } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    await supabase
      .from("tutoring_sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        focus_score_avg: focusScore || null,
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
