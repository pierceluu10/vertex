import { NextResponse } from "next/server";
import { getSimliAvatarConfig } from "@/lib/avatar-config";
import { createServiceClient } from "@/lib/supabase/server";
import { loadTutorContext } from "@/lib/tutor-context";

export async function POST(request: Request) {
  try {
    const { kidSessionId, parentId, documentId } = await request.json();

    if (!kidSessionId) {
      return NextResponse.json({ error: "Missing kidSessionId" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    let childId: string | null = null;
    let kidSessionName: string | null = null;

    if (parentId) {
      const { data: kidSession } = await supabase
        .from("kids_sessions")
        .select("child_id, child_name")
        .eq("id", kidSessionId)
        .maybeSingle();

      kidSessionName = kidSession?.child_name?.trim() || null;
      childId = kidSession?.child_id ?? null;

      if (!childId) {
        console.error("Student session error: kids_sessions.child_id is missing", {
          kidSessionId,
          parentId,
          kidSessionName,
        });
        return NextResponse.json(
          { error: "Student profile is not linked correctly. Please re-enter the access code." },
          { status: 400 }
        );
      }
    }

    let session: { id: string } | null = null;
    let hasKidSessionIdColumn = true;

    // Try to find an existing active session for this kid session
    const baseQuery = supabase
      .from("tutoring_sessions")
      .select("id, status")
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1);

    const existingQuery = supabase
      .from("tutoring_sessions")
      .select("id, status")
      .eq("kid_session_id", kidSessionId)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1);

    const { data: existingSessions, error: existingSessionError } = documentId
      ? await existingQuery.eq("document_id", documentId)
      : await existingQuery.is("document_id", null);

    if (existingSessionError) {
      if (existingSessionError.message?.includes("kid_session_id")) {
        hasKidSessionIdColumn = false;
      } else {
        console.error("Session reuse lookup error:", existingSessionError);
      }
    }

    session = existingSessions?.[0] || null;

    if (!session) {
      // Try insert with kid_session_id first; fall back without if column missing
      const insertPayload: Record<string, unknown> = {
        child_id: childId,
        document_id: documentId || null,
        status: "active",
      };

      if (hasKidSessionIdColumn) {
        insertPayload.kid_session_id = kidSessionId;
      }

      const { data: createdSession, error } = await supabase
        .from("tutoring_sessions")
        .insert(insertPayload)
        .select("id")
        .single();

      if (error) {
        if (error.message?.includes("kid_session_id")) {
          // Column doesn't exist yet — retry without it
          hasKidSessionIdColumn = false;
          delete insertPayload.kid_session_id;
          const { data: retrySession, error: retryError } = await supabase
            .from("tutoring_sessions")
            .insert(insertPayload)
            .select("id")
            .single();

          if (retryError) {
            console.error("Session creation error (retry):", retryError);
            return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
          }
          session = retrySession;
        } else {
          console.error("Session creation error:", error);
          return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
        }
      } else {
        session = createdSession;
      }
    }

    void baseQuery; // suppress unused warning

    const tutorContext = await loadTutorContext(supabase, {
      sessionId: session.id,
      kidSessionId,
      parentId,
      documentId,
    });
    const simliConfig = getSimliAvatarConfig();
    // Award XP for starting a session
    if (!existingSessions?.[0]) {
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
    }

    return NextResponse.json({
      sessionId: session.id,
      documentContext: tutorContext.documentContext,
      lessonPlan: tutorContext.lessonPlan,
      parentName: tutorContext.parentName,
      liveTutorEnabled: simliConfig.ready,
      tutorAvatarName: simliConfig.displayName,
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
