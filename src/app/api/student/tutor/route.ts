import { NextResponse } from "next/server";
import {
  getLiveAvatarSupport,
  getLiveKitConfig,
  getSimliAvatarConfig,
} from "@/lib/avatar-config";
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
      .select("name")
      .eq("id", parentId)
      .maybeSingle();

    if (error) {
      console.error("Student tutor lookup error:", error);
      return NextResponse.json({ error: "Failed to load tutor" }, { status: 500 });
    }

    if (!parent) {
      return NextResponse.json({ error: "Tutor not found" }, { status: 404 });
    }

    const simliConfig = getSimliAvatarConfig();
    const avatarSupport = getLiveAvatarSupport(getLiveKitConfig().url);

    return NextResponse.json({
      tutor: {
        name: parent.name,
        liveTutorEnabled: simliConfig.ready,
        avatarName: simliConfig.displayName,
        avatarVideoSupported: avatarSupport.supported,
        avatarVideoReason: avatarSupport.reason,
      },
    });
  } catch (error) {
    console.error("Student tutor error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
