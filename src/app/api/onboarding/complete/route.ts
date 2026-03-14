import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { childName, childAge, childGrade, preferredPace } = body as {
      childName: string;
      childAge: string;
      childGrade: string;
      preferredPace: string;
    };

    if (!childName?.trim() || !childAge) {
      return NextResponse.json(
        { error: "Name and age are required." },
        { status: 400 }
      );
    }

    const supabase = createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Ensure parent row exists (e.g. if signup skipped it or account predates parents table)
    const fullName =
      (user.user_metadata?.full_name as string)?.trim() || "Parent";
    await supabase.from("parents").upsert(
      {
        id: user.id,
        full_name: fullName,
        email: user.email ?? "",
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    const age = parseInt(childAge, 10);
    if (Number.isNaN(age) || age < 3 || age > 14) {
      return NextResponse.json(
        { error: "Please enter a valid age (3–14)." },
        { status: 400 }
      );
    }

    const { data: child, error: childError } = await supabase
      .from("children")
      .insert({
        parent_id: user.id,
        name: childName.trim(),
        age,
        grade: (childGrade?.trim() as string) || null,
      })
      .select()
      .single();

    if (childError) {
      return NextResponse.json(
        { error: childError.message },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabase
      .from("learning_profiles")
      .insert({
        child_id: child.id,
        preferred_pace: preferredPace || "normal",
      });

    if (profileError) {
      console.error("Profile error:", profileError);
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Onboarding complete error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
