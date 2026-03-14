import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

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

    // Use anon client (no auth): RLS allows anyone to read active access_codes and manage kids_sessions
    const supabase = createClientFromRequest(request);

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
          error: "Something went wrong. Please try again.",
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

    // Check if a kid session already exists for this code
    const { data: existingSession } = await supabase
      .from("kids_sessions")
      .select("*")
      .eq("code_used", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSession) {
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
      return NextResponse.json(
        { success: false, error: "Something went wrong. Please try again." },
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
    return NextResponse.json(
      { success: false, error: "Something went wrong." },
      { status: 500 }
    );
  }
}
