import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { childName, childAge, childGrade, preferredPace, mathTopics } = body as {
      childName: string;
      childAge: string;
      childGrade: string;
      preferredPace: string;
      mathTopics?: string[];
    };

    if (!childName?.trim() || !childAge) {
      return NextResponse.json({ error: "Name and age are required." }, { status: 400 });
    }

    const supabase = createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Update parent record with learning config
    const fullName = (user.user_metadata?.full_name as string)?.trim() || "Parent";
    await supabase.from("parents").upsert(
      {
        id: user.id,
        name: fullName,
        email: user.email ?? "",
        child_name: childName.trim(),
        grade_level: childGrade?.trim() || null,
        math_topics: mathTopics || [],
        learning_pace: preferredPace || "medium",
      },
      { onConflict: "id" }
    );

    const age = parseInt(childAge, 10);
    if (Number.isNaN(age) || age < 3 || age > 18) {
      return NextResponse.json({ error: "Please enter a valid age (3–18)." }, { status: 400 });
    }

    // Create child record
    const { data: child, error: childError } = await supabase
      .from("children")
      .insert({
        parent_id: user.id,
        name: childName.trim(),
        age,
        grade: childGrade?.trim() || null,
      })
      .select()
      .single();

    if (childError) {
      return NextResponse.json({ error: childError.message }, { status: 400 });
    }

    // Create learning profile
    const { error: profileError } = await supabase
      .from("learning_profiles")
      .insert({
        child_id: child.id,
        preferred_pace: preferredPace || "normal",
        topics_struggled: mathTopics || [],
      });

    if (profileError) {
      console.error("Profile error:", profileError);
    }

    // Auto-generate access code for this child
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await supabase.from("access_codes").insert({
      parent_id: user.id,
      code,
      child_name: childName.trim(),
      is_active: true,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Onboarding complete error:", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
