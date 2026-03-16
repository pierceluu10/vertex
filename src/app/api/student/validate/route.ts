import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const raw = body?.code != null ? String(body.code).trim() : "";
    const code = raw.replace(/\D/g, "").slice(0, 6);

    if (code.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid 6-digit code." },
        { status: 400 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      console.error("Student validate: SUPABASE_SERVICE_ROLE_KEY is missing or empty");
      return NextResponse.json(
        { success: false, error: "Server misconfiguration. Please try again later." },
        { status: 500 }
      );
    }
    const supabase = await createServiceClient();

    const { data: accessCode, error: codeError } = await supabase
      .from("access_codes")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    if (codeError) {
      console.error("Access code lookup error:", codeError);
      const isDev = process.env.NODE_ENV === "development";
      return NextResponse.json(
        {
          success: false,
          error: isDev ? `Access code lookup failed: ${codeError.message}` : "Something went wrong. Please try again.",
          ...(isDev && { debug: { message: codeError.message, code: codeError.code, details: codeError.details } }),
        },
        { status: 500 }
      );
    }
    if (!accessCode) {
      const isDev = process.env.NODE_ENV === "development";
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired code. Ask your parent for a new one.",
          ...(isDev && { debug: { lookupCode: code, hint: "No row found for this code. Check that the code exists in access_codes and is_active is true." } }),
        },
        { status: 404 }
      );
    }

    let childId: string | null = null;

    const normalizedChildName = accessCode.child_name?.trim() || "Student";
    const fallbackChildAge =
      typeof accessCode.child_age === "number" && !Number.isNaN(accessCode.child_age)
        ? accessCode.child_age
        : 10;
    const fallbackGradeLevel =
      typeof accessCode.grade_level === "string" ? accessCode.grade_level.trim() || null : null;

    const { data: existingChild, error: childLookupError } = await supabase
      .from("children")
      .select("id")
      .eq("parent_id", accessCode.parent_id)
      .eq("name", normalizedChildName)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (childLookupError) {
      console.error("Child lookup error during student validate:", childLookupError);
      const isDev = process.env.NODE_ENV === "development";
      return NextResponse.json(
        {
          success: false,
          error: isDev
            ? `Could not resolve child: ${childLookupError.message}`
            : "Something went wrong. Please try again.",
          ...(isDev && {
            debug: {
              message: childLookupError.message,
              code: childLookupError.code,
              details: childLookupError.details,
            },
          }),
        },
        { status: 500 }
      );
    }

    if (existingChild?.id) {
      childId = existingChild.id;
    } else {
      const { data: createdChild, error: childCreateError } = await supabase
        .from("children")
        .insert({
          parent_id: accessCode.parent_id,
          name: normalizedChildName,
          age: fallbackChildAge,
          grade: fallbackGradeLevel,
        })
        .select("id")
        .single();

      if (childCreateError || !createdChild) {
        console.error("Child create error during student validate:", childCreateError);
        const isDev = process.env.NODE_ENV === "development";
        return NextResponse.json(
          {
            success: false,
            error: isDev && childCreateError
              ? `Could not create child: ${childCreateError.message}`
              : "Something went wrong. Please try again.",
            ...(isDev && childCreateError && {
              debug: {
                message: childCreateError.message,
                code: childCreateError.code,
                details: childCreateError.details,
              },
            }),
          },
          { status: 500 }
        );
      }

      childId = createdChild.id;
    }

    // Check if a kid session already exists for this code
    const { data: existingSession } = await supabase
      .from("kids_sessions")
      .select("*")
      .eq("code_used", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSession) {
      if (!existingSession.child_id || existingSession.child_id !== childId) {
        const { error: repairError } = await supabase
          .from("kids_sessions")
          .update({ child_id: childId, child_name: normalizedChildName })
          .eq("id", existingSession.id);

        if (repairError) {
          console.error("Kid session repair error:", repairError);
          const isDev = process.env.NODE_ENV === "development";
          return NextResponse.json(
            {
              success: false,
              error: isDev
                ? `Could not repair student session: ${repairError.message}`
                : "Something went wrong. Please try again.",
              ...(isDev && {
                debug: {
                  message: repairError.message,
                  code: repairError.code,
                  details: repairError.details,
                },
              }),
            },
            { status: 500 }
          );
        }

        existingSession.child_id = childId;
        existingSession.child_name = normalizedChildName;
      }

      // Update streak
      const today = new Date().toISOString().split("T")[0];
      const lastActive = existingSession.last_active_date;
      let newStreak = existingSession.streak_count;

      if (lastActive !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        newStreak = lastActive === yesterdayStr ? newStreak + 1 : 1;

        await supabase
          .from("kids_sessions")
          .update({ streak_count: newStreak, last_active_date: today })
          .eq("id", existingSession.id);
      }

      return NextResponse.json({
        success: true,
        kidSession: { ...existingSession, streak_count: newStreak, last_active_date: today },
        isReturning: true,
      });
    }

    // Create new kid session
    const { data: kidSession, error: sessionError } = await supabase
      .from("kids_sessions")
      .insert({
        child_id: childId,
        parent_id: accessCode.parent_id,
        code_used: code,
        child_name: accessCode.child_name,
        streak_count: 1,
        xp_points: 0,
        last_active_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (sessionError || !kidSession) {
      console.error("Kid session creation error:", sessionError);
      const isDev = process.env.NODE_ENV === "development";
      return NextResponse.json(
        {
          success: false,
          error: isDev && sessionError ? `Could not create session: ${sessionError.message}` : "Something went wrong. Please try again.",
          ...(isDev && sessionError && { debug: { message: sessionError.message, code: sessionError.code, details: sessionError.details } }),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      kidSession,
      isReturning: false,
    });
  } catch (error) {
    console.error("Student validate error:", error);
    const isDev = process.env.NODE_ENV === "development";
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: isDev ? `Error: ${errMsg}` : "Something went wrong.",
        ...(isDev && { debug: { message: errMsg } }),
      },
      { status: 500 }
    );
  }
}
