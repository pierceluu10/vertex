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
    let accessCodeUsed: string | null = null;

    if (parentId) {
      const { data: kidSession } = await supabase
        .from("kids_sessions")
        .select("child_name, code_used")
        .eq("id", kidSessionId)
        .maybeSingle();

      kidSessionName = kidSession?.child_name?.trim() || null;
      accessCodeUsed = kidSession?.code_used || null;

      const { data: children } = await supabase
        .from("children")
        .select("id, name")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: true });

      if (children?.length) {
        const childName = kidSessionName?.toLowerCase();
        const matchedChild =
          (childName
            ? children.find((child) => child.name?.trim().toLowerCase() === childName)
            : null) || children[0];

        childId = matchedChild.id;
      }

      if (!childId && kidSessionName) {
        let fallbackAge = 10;
        let fallbackGrade: string | null = null;

        if (accessCodeUsed) {
          const { data: accessCode } = await supabase
            .from("access_codes")
            .select("child_age, grade_level")
            .eq("code", accessCodeUsed)
            .maybeSingle();

          fallbackAge = accessCode?.child_age ?? fallbackAge;
          fallbackGrade = accessCode?.grade_level ?? null;
        }

        const { data: createdChild, error: createChildError } = await supabase
          .from("children")
          .insert({
            parent_id: parentId,
            name: kidSessionName,
            age: fallbackAge,
            grade: fallbackGrade,
          })
          .select("id")
          .single();

        if (createChildError) {
          console.error("Child auto-create error:", createChildError);
        } else {
          childId = createdChild.id;
        }
      }
    }

    if (!childId) {
      return NextResponse.json(
        { error: "No child record found for this tutoring session" },
        { status: 400 }
      );
    }

    let session = null;

    const existingSessionQuery = supabase
      .from("tutoring_sessions")
      .select("*")
      .eq("child_id", childId)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1);

    const { data: existingSessions, error: existingSessionError } = documentId
      ? await existingSessionQuery.eq("document_id", documentId)
      : await existingSessionQuery.is("document_id", null);

    if (existingSessionError) {
      console.error("Session reuse lookup error:", existingSessionError);
    }

    session = existingSessions?.[0] || null;

    if (!session) {
      const { data: createdSession, error } = await supabase
        .from("tutoring_sessions")
        .insert({
          child_id: childId,
          document_id: documentId || null,
          status: "active",
        })
        .select()
        .single();

      if (error) {
        console.error("Session creation error:", error);
        return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
      }

      session = createdSession;
    }

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
