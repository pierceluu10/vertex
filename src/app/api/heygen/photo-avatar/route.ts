import { NextResponse } from "next/server";
import { createClientFromRequest, createServiceClient } from "@/lib/supabase/server";

/**
 * Creates a HeyGen Photo Avatar (talking photo) from an uploaded image.
 * Flow: 1) Upload image to HeyGen, 2) Create photo avatar group.
 * See https://docs.heygen.com/docs/create-and-train-photo-avatar-groups
 */
export async function POST(request: Request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HeyGen API key not configured" }, { status: 500 });
  }

  const authClient = createClientFromRequest(request);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const photo = formData.get("photo") as File | null;

    if (!photo) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    const validTypes = ["image/jpeg", "image/png"];
    if (!validTypes.includes(photo.type)) {
      return NextResponse.json({ error: "Photo must be JPG or PNG" }, { status: 400 });
    }

    const MAX_SIZE_MB = 10;
    if (photo.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({
        error: `Photo is too large (${(photo.size / (1024 * 1024)).toFixed(1)} MB). Maximum is ${MAX_SIZE_MB} MB.`,
      }, { status: 400 });
    }

    const arrayBuffer = await photo.arrayBuffer();
    const contentType = photo.type === "image/png" ? "image/png" : "image/jpeg";

    // 1. Upload to HeyGen
    const uploadRes = await fetch("https://upload.heygen.com/v1/asset", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": contentType,
      },
      body: arrayBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("HeyGen upload error:", errText);
      return NextResponse.json({ error: "Photo upload failed" }, { status: 502 });
    }

    const uploadData = (await uploadRes.json()) as {
      code?: number;
      data?: { image_key?: string };
      message?: string;
    };

    if (uploadData.code !== 100 || !uploadData.data?.image_key) {
      return NextResponse.json({
        error: uploadData.message || "Photo upload failed",
      }, { status: 502 });
    }

    const imageKey = uploadData.data.image_key;

    // 2. Delete existing avatar if parent has one (replace instead of duplicate)
    const supabase = await createServiceClient();
    const { data: existingParent } = await supabase
      .from("parents")
      .select("heygen_talking_photo_id")
      .eq("id", user.id)
      .single();

    if (existingParent?.heygen_talking_photo_id) {
      try {
        await fetch(
          `https://api.heygen.com/v2/photo_avatar_group/${existingParent.heygen_talking_photo_id}`,
          {
            method: "DELETE",
            headers: { "x-api-key": apiKey },
          }
        );
      } catch {
        // Ignore delete errors; we'll create the new one anyway
      }
    }

    // 3. Create photo avatar group (stable name: one per parent)
    const createRes = await fetch("https://api.heygen.com/v2/photo_avatar/avatar_group/create", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        name: `parent-${user.id}`,
        image_key: imageKey,
      }),
    });

    const createData = (await createRes.json()) as {
      error?: string;
      data?: { id?: string; group_id?: string; status?: string };
    };

    if (!createRes.ok || createData.error) {
      console.error("HeyGen photo avatar create error:", createData);
      return NextResponse.json({
        error: createData.error || "Failed to create photo avatar",
      }, { status: createRes.ok ? 500 : createRes.status });
    }

    const talkingPhotoId = createData.data?.id ?? createData.data?.group_id;
    if (!talkingPhotoId) {
      return NextResponse.json({ error: "No avatar ID returned" }, { status: 500 });
    }

    // 4. Save to parents
    const { error: dbError } = await supabase
      .from("parents")
      .update({ heygen_talking_photo_id: talkingPhotoId })
      .eq("id", user.id);

    if (dbError) {
      console.error("Photo avatar DB update error:", dbError);
      return NextResponse.json({
        error: "Avatar created but profile update failed. Run migration: alter table parents add column if not exists heygen_talking_photo_id text;",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      talking_photo_id: talkingPhotoId,
      status: createData.data?.status ?? "pending",
    });
  } catch (err) {
    console.error("Photo avatar error:", err);
    return NextResponse.json({ error: "Failed to create photo avatar" }, { status: 500 });
  }
}
