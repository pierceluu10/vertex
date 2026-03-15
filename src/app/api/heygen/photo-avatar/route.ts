import { NextResponse } from "next/server";
import { createClientFromRequest, createServiceClient } from "@/lib/supabase/server";

/**
 * Creates a HeyGen Talking Photo from an uploaded image.
 * Flow:
 *   1) Upload image to HeyGen asset storage → get image_url
 *   2) Create a talking photo via POST /v1/talking_photo
 *   3) Store the talking_photo_id in the parents table
 */
export async function POST(request: Request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    console.error("[photo-avatar] HEYGEN_API_KEY not set");
    return NextResponse.json({ error: "HeyGen API key not configured" }, { status: 500 });
  }

  const authClient = createClientFromRequest(request);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    console.error("[photo-avatar] No authenticated user");
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
        error: `Photo too large (${(photo.size / (1024 * 1024)).toFixed(1)} MB). Max ${MAX_SIZE_MB} MB.`,
      }, { status: 400 });
    }

    // ── Step 1: Upload image to HeyGen ──────────────────────────────
    const arrayBuffer = await photo.arrayBuffer();
    const contentType = photo.type === "image/png" ? "image/png" : "image/jpeg";

    console.log("[photo-avatar] Uploading image to HeyGen...");
    const uploadRes = await fetch("https://upload.heygen.com/v1/asset", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": contentType,
      },
      body: arrayBuffer,
    });

    const uploadText = await uploadRes.text();
    console.log("[photo-avatar] Upload response:", uploadRes.status, uploadText);

    if (!uploadRes.ok) {
      return NextResponse.json(
        { error: `Photo upload failed (${uploadRes.status}): ${uploadText}` },
        { status: 502 },
      );
    }

    let uploadData: Record<string, unknown>;
    try {
      uploadData = JSON.parse(uploadText);
    } catch {
      return NextResponse.json(
        { error: "HeyGen returned invalid response from upload" },
        { status: 502 },
      );
    }

    // HeyGen upload returns: { code: 100, data: { image_key: "...", url: "..." }, message: "Success" }
    // or possibly: { data: { url: "..." } }
    const uploadDataInner = uploadData.data as Record<string, string> | undefined;
    const imageKey = uploadDataInner?.image_key;
    const imageUrl = uploadDataInner?.url;

    if (!imageKey && !imageUrl) {
      console.error("[photo-avatar] No image_key or url in upload response:", uploadData);
      return NextResponse.json(
        { error: "Photo upload succeeded but no image reference returned" },
        { status: 502 },
      );
    }

    console.log("[photo-avatar] Upload OK. image_key:", imageKey, "url:", imageUrl);

    // ── Step 2: Create talking photo ────────────────────────────────
    // Try the v1 talking_photo endpoint first, then v2 photo_avatar as fallback
    let talkingPhotoId: string | null = null;

    // Approach A: POST /v1/talking_photo (most reliable for creating a talking photo)
    console.log("[photo-avatar] Creating talking photo via v1 API...");
    const createBody: Record<string, string> = {};
    if (imageUrl) {
      createBody.image_url = imageUrl;
    } else if (imageKey) {
      createBody.image_key = imageKey;
    }

    const createRes = await fetch("https://api.heygen.com/v1/talking_photo", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(createBody),
    });

    const createText = await createRes.text();
    console.log("[photo-avatar] v1 talking_photo response:", createRes.status, createText);

    let createData: Record<string, unknown>;
    try {
      createData = JSON.parse(createText);
    } catch {
      createData = {};
    }

    const createDataInner = createData.data as Record<string, string> | undefined;

    if (createRes.ok && !createData.error) {
      talkingPhotoId =
        createDataInner?.talking_photo_id ||
        createDataInner?.id ||
        (typeof createData.talking_photo_id === "string" ? createData.talking_photo_id : null);
    }

    // Approach B: If v1 failed, try v2 photo_avatar
    if (!talkingPhotoId) {
      console.log("[photo-avatar] v1 failed, trying v2 photo_avatar...");
      const v2Body: Record<string, string> = { name: `parent-${user.id}` };
      if (imageKey) v2Body.image_key = imageKey;
      if (imageUrl) v2Body.image_url = imageUrl;

      const v2Res = await fetch("https://api.heygen.com/v2/photo_avatar", {
        method: "POST",
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(v2Body),
      });

      const v2Text = await v2Res.text();
      console.log("[photo-avatar] v2 photo_avatar response:", v2Res.status, v2Text);

      let v2Data: Record<string, unknown>;
      try {
        v2Data = JSON.parse(v2Text);
      } catch {
        v2Data = {};
      }

      const v2DataInner = v2Data.data as Record<string, string> | undefined;

      if (v2Res.ok && !v2Data.error) {
        talkingPhotoId =
          v2DataInner?.talking_photo_id ||
          v2DataInner?.id ||
          v2DataInner?.group_id ||
          (typeof v2Data.talking_photo_id === "string" ? v2Data.talking_photo_id : null);
      }

      // Approach C: Try v2 photo_avatar/avatar_group/create as last resort
      if (!talkingPhotoId) {
        console.log("[photo-avatar] v2 failed, trying avatar_group/create...");
        const v2GroupRes = await fetch("https://api.heygen.com/v2/photo_avatar/avatar_group/create", {
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

        const v2GroupText = await v2GroupRes.text();
        console.log("[photo-avatar] avatar_group/create response:", v2GroupRes.status, v2GroupText);

        let v2GroupData: Record<string, unknown>;
        try {
          v2GroupData = JSON.parse(v2GroupText);
        } catch {
          v2GroupData = {};
        }

        const v2GroupInner = v2GroupData.data as Record<string, string> | undefined;

        if (v2GroupRes.ok && !v2GroupData.error) {
          talkingPhotoId = v2GroupInner?.id || v2GroupInner?.group_id || null;
        }

        if (!talkingPhotoId) {
          // All approaches failed
          const lastError = (v2GroupData.error as string) || v2Text || createText;
          console.error("[photo-avatar] All avatar creation approaches failed");
          return NextResponse.json(
            { error: `Failed to create avatar. HeyGen says: ${lastError}` },
            { status: 502 },
          );
        }
      }
    }

    console.log("[photo-avatar] Avatar created! ID:", talkingPhotoId);

    // ── Step 3: Save to database ────────────────────────────────────
    const supabase = await createServiceClient();
    const { error: dbError } = await supabase
      .from("parents")
      .update({ heygen_talking_photo_id: talkingPhotoId })
      .eq("id", user.id);

    if (dbError) {
      console.error("[photo-avatar] DB update error:", dbError);
      return NextResponse.json({
        error: `Avatar created (ID: ${talkingPhotoId}) but DB update failed: ${dbError.message}`,
      }, { status: 500 });
    }

    console.log("[photo-avatar] Saved to DB successfully");

    return NextResponse.json({
      success: true,
      talking_photo_id: talkingPhotoId,
    });
  } catch (err) {
    console.error("[photo-avatar] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create photo avatar" },
      { status: 500 },
    );
  }
}
