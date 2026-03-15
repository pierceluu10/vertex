import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId")?.trim();

    if (!parentId) {
      return NextResponse.json({ error: "Missing parentId" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data: parent, error } = await supabase
      .from("parents")
      .select("name, heygen_avatar_id")
      .eq("id", parentId)
      .maybeSingle();

    if (error) {
      console.error("Student tutor lookup error:", error);
      return NextResponse.json({ error: "Failed to load tutor" }, { status: 500 });
    }

    if (!parent) {
      return NextResponse.json({ error: "Tutor not found" }, { status: 404 });
    }

    return NextResponse.json({
      tutor: {
        name: parent.name,
        heygenAvatarId: parent.heygen_avatar_id,
      },
    });
  } catch (error) {
    console.error("Student tutor error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
