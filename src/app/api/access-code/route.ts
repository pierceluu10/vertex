import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure parent row exists (e.g. OAuth users or legacy signups may not have one)
    const { data: existingParent } = await supabase
      .from("parents")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingParent) {
      const { error: parentError } = await supabase.from("parents").insert({
        id: user.id,
        email: user.email ?? "",
        name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Parent",
      });
      if (parentError) {
        console.error("Parent upsert error:", parentError);
        return NextResponse.json(
          { error: "Please complete your profile in Settings first." },
          { status: 400 }
        );
      }
    }

    const body = await request.json();
    const childName = body.childName?.trim() || null;
    const childAge = body.childAge != null ? Number(body.childAge) : null;
    const gradeLevel = body.gradeLevel?.trim() || null;
    const mathTopics = Array.isArray(body.mathTopics) ? body.mathTopics : (body.mathTopics ? [body.mathTopics] : []);
    const learningGoals = typeof body.learningGoals === "string" ? body.learningGoals.trim() || null : null;
    const learningPace = body.learningPace === "slow" || body.learningPace === "medium" || body.learningPace === "fast" ? body.learningPace : "medium";

    if (!childName) {
      return NextResponse.json({ error: "Child's name is required." }, { status: 400 });
    }
    if (childAge == null || childAge < 3 || childAge > 18) {
      return NextResponse.json({ error: "Child's age is required and must be between 3 and 18." }, { status: 400 });
    }
    if (!gradeLevel) {
      return NextResponse.json({ error: "Grade level is required." }, { status: 400 });
    }

    let code = generateCode();
    let attempts = 0;

    // Ensure unique code
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from("access_codes")
        .select("id")
        .eq("code", code)
        .maybeSingle();

      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    const { data: accessCode, error } = await supabase
      .from("access_codes")
      .insert({
        parent_id: user.id,
        code,
        child_name: childName,
        child_age: childAge,
        grade_level: gradeLevel,
        math_topics: mathTopics,
        learning_goals: learningGoals,
        learning_pace: learningPace,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Access code creation error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to generate code" },
        { status: 500 }
      );
    }

    return NextResponse.json({ accessCode });
  } catch (error) {
    console.error("Access code API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: codes } = await supabase
      .from("access_codes")
      .select("*")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ codes: codes || [] });
  } catch (error) {
    console.error("Access code GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { codeId } = await request.json();

    await supabase
      .from("access_codes")
      .update({ is_active: false })
      .eq("id", codeId)
      .eq("parent_id", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Access code DELETE error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const codeId = typeof body.codeId === "string" ? body.codeId : "";

    if (!codeId) {
      return NextResponse.json({ error: "Access code is required." }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.childName === "string") {
      updates.child_name = body.childName.trim() || null;
    }

    if (body.childAge != null && body.childAge !== "") {
      const childAge = Number(body.childAge);
      if (Number.isNaN(childAge) || childAge < 3 || childAge > 18) {
        return NextResponse.json({ error: "Child age must be between 3 and 18." }, { status: 400 });
      }
      updates.child_age = childAge;
    }

    if (typeof body.gradeLevel === "string") {
      updates.grade_level = body.gradeLevel.trim() || null;
    }

    if (Array.isArray(body.mathTopics)) {
      updates.math_topics = body.mathTopics;
    }

    if (typeof body.learningGoals === "string") {
      updates.learning_goals = body.learningGoals.trim() || null;
    }

    if (body.learningPace === "slow" || body.learningPace === "medium" || body.learningPace === "fast") {
      updates.learning_pace = body.learningPace;
    }

    const { data: accessCode, error } = await supabase
      .from("access_codes")
      .update(updates)
      .eq("id", codeId)
      .eq("parent_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Access code PATCH error:", error);
      return NextResponse.json({ error: error.message || "Failed to update access code" }, { status: 500 });
    }

    return NextResponse.json({ accessCode });
  } catch (error) {
    console.error("Access code PATCH error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
