import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { kidSessionId, avatarChoice } = await request.json();

    if (!kidSessionId || !avatarChoice) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { error } = await supabase
      .from("kids_sessions")
      .update({ avatar_choice: avatarChoice })
      .eq("id", kidSessionId);

    if (error) {
      console.error("Avatar update error:", error);
      return NextResponse.json({ error: "Failed to save avatar choice" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Student avatar error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
