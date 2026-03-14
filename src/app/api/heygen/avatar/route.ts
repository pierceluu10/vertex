import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

    const serviceSupabase = await createServiceClient();
    const { error: uploadError } = await serviceSupabase.storage
      .from("documents")
      .upload(fileName, videoBuffer, {
        contentType: video.type,
        upsert: true,
      });

    if (uploadError) {
      const message =
        uploadError.message?.toLowerCase().includes("bucket") ||
        uploadError.message?.toLowerCase().includes("not found")
          ? "Upload failed: Storage bucket not found. In Supabase Dashboard go to Storage → New bucket, create a bucket named 'documents' (public), then try again."
          : uploadError.message?.toLowerCase().includes("row-level security") || uploadError.message?.toLowerCase().includes("policy")
          ? "Upload failed: Storage permissions error. The app now uses elevated permissions for this upload; if you still see this, check that the 'documents' bucket exists and is public."
          : "Upload failed: " + uploadError.message;
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const { data: { publicUrl } } = serviceSupabase.storage.from("documents").getPublicUrl(fileName);

    const { error: dbError } = await serviceSupabase
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
        await serviceSupabase
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
