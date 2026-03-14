import { NextResponse } from "next/server";
import { createClientFromRequest, createServiceClient } from "@/lib/supabase/server";

/**
 * Submits the parent's training + consent videos to create an AI avatar.
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

  let body: { trainingVideoUrl: string; consentVideoUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { trainingVideoUrl, consentVideoUrl } = body;
  if (!trainingVideoUrl) {
    return NextResponse.json({ error: "trainingVideoUrl is required" }, { status: 400 });
  }

  // Verify training video is still accessible (user may have deleted it from storage)
  try {
    const headRes = await fetch(trainingVideoUrl, { method: "HEAD" });
    if (!headRes.ok) {
      return NextResponse.json({
        error: "Training video was deleted or is no longer accessible. Please upload it again.",
      }, { status: 400 });
    }
  } catch {
    return NextResponse.json({
      error: "Training video URL is not reachable. Please upload your video again.",
    }, { status: 400 });
  }

  if (!consentVideoUrl) {
    return NextResponse.json({
      error: "Consent video is required.",
    }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.heygen.com/v2/video_avatar", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        training_footage_url: trainingVideoUrl,
        video_consent_url: consentVideoUrl,
        avatar_name: `parent-avatar-${user.id}`,
      }),
    });

    let data: Record<string, unknown>;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({
        error: "HeyGen API returned an invalid response. Please try again later.",
      }, { status: 502 });
    }

    if (!res.ok) {
      const errObj = data?.error as { code?: string; message?: string } | undefined;
      const errCode = errObj?.code ?? (data?.code as string | undefined);
      const errMsg = (typeof errObj?.message === "string" ? errObj.message : null)
        ?? (typeof data?.error === "string" ? data.error : null)
        ?? JSON.stringify(data);
      const msg = String(errMsg);
      console.error("HeyGen avatar creation error:", { status: res.status, errCode, errMsg, data });

      let userMessage = "Avatar creation failed. Please try again.";
      if (res.status === 403) {
        userMessage = (msg.length < 200 && !msg.startsWith("{")) ? msg : "Avatar creation failed. Please try again.";
      } else if (res.status === 400 && msg.length < 200 && !msg.startsWith("{")) {
        userMessage = msg;
      }

      return NextResponse.json({ error: userMessage }, { status: res.status });
    }

    const avatarId = (data?.data as { avatar_id?: string } | undefined)?.avatar_id;
    if (!avatarId) {
      return NextResponse.json({ error: "Avatar creation failed" }, { status: 500 });
    }

    const supabase = await createServiceClient();
    await supabase
      .from("parents")
      .update({ heygen_avatar_id: avatarId })
      .eq("id", user.id);

    return NextResponse.json({ success: true, avatarId });
  } catch (err) {
    console.error("Avatar creation error:", err);
    return NextResponse.json({ error: "Failed to create avatar" }, { status: 500 });
  }
}
