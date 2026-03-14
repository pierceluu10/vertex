import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HeyGen API key not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const video = formData.get("video") as File | null;

    if (!video) {
      return NextResponse.json({ error: "No video provided" }, { status: 400 });
    }

    const videoBuffer = Buffer.from(await video.arrayBuffer());
    const fileName = `avatars/${user.id}/${Date.now()}-${video.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, videoBuffer, {
        contentType: video.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(fileName);

    const { error: dbError } = await supabase
      .from("parents")
      .update({
        avatar_url: publicUrl,
      })
      .eq("id", user.id);

    if (dbError) {
      console.error("DB update error:", dbError);
    }

    const avatarRes = await fetch("https://api.heygen.com/v2/photo_avatar/photo/generate", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `parent-avatar-${user.id}`,
        image_url: publicUrl,
      }),
    });

    let heygenAvatarId: string | null = null;

    if (avatarRes.ok) {
      const avatarData = await avatarRes.json();
      heygenAvatarId = avatarData.data?.photo_avatar_id || avatarData.data?.avatar_id || null;

      if (heygenAvatarId) {
        await supabase
          .from("parents")
          .update({ heygen_avatar_id: heygenAvatarId })
          .eq("id", user.id);
      }
    } else {
      const errText = await avatarRes.text();
      console.error("HeyGen avatar creation error:", errText);
    }

    return NextResponse.json({
      success: true,
      videoUrl: publicUrl,
      heygenAvatarId,
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ error: "Failed to process avatar" }, { status: 500 });
  }
}
