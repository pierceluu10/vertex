import { NextResponse } from "next/server";
import { createClientFromRequest, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const authClient = createClientFromRequest(request);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  try {
    const formData = await request.formData();
    const video = formData.get("video") as File | null;

    if (!video) {
      return NextResponse.json({ error: "No video provided" }, { status: 400 });
    }

    const MAX_SIZE_MB = 50;
    if (video.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({
        error: `Video is too large (${(video.size / (1024 * 1024)).toFixed(1)} MB). Maximum is ${MAX_SIZE_MB} MB.`,
      }, { status: 400 });
    }

    const videoBuffer = Buffer.from(await video.arrayBuffer());
    const consentOnly = formData.get("consentOnly") === "true";
    const path = consentOnly
      ? `${user.id}/consent-${Date.now()}-${video.name}`
      : `${user.id}/${Date.now()}-${video.name}`;

    const { data: buckets } = await supabase.storage.listBuckets();
    let bucketName = "avatars";

    if (!buckets?.some((b) => b.name === "avatars")) {
      const { error: createError } = await supabase.storage.createBucket("avatars", {
        public: true,
      });
      if (createError && !createError.message.includes("already exists")) {
        if (buckets?.some((b) => b.name === "documents")) {
          bucketName = "documents";
        } else {
          console.error("Bucket creation error:", createError);
          return NextResponse.json({
            error: "Storage setup failed. Create an 'avatars' or 'documents' bucket in Supabase Dashboard → Storage.",
          }, { status: 500 });
        }
      }
    }

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(path, videoBuffer, {
        contentType: video.type || "video/webm",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(path);

    if (!consentOnly) {
      const { error: dbError } = await supabase
        .from("parents")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (dbError) {
        console.error("DB update error:", dbError);
      }
    }

    return NextResponse.json({
      success: true,
      videoUrl: publicUrl,
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ error: "Failed to process avatar" }, { status: 500 });
  }
}
