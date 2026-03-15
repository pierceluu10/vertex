import { NextResponse } from "next/server";
import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
import {
  getLiveAvatarSupport,
  getLiveKitConfig,
  getSimliAvatarConfig,
} from "@/lib/avatar-config";
import { buildRealtimeTutorInstructions } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";
import { loadTutorContext } from "@/lib/tutor-context";

export async function POST(request: Request) {
  try {
    const { sessionId, kidSessionId, parentId, documentId } = await request.json();

    if (!sessionId || !parentId) {
      return NextResponse.json(
        { error: "Missing sessionId or parentId" },
        { status: 400 }
      );
    }

    const simliConfig = getSimliAvatarConfig();
    if (!simliConfig.ready) {
      return NextResponse.json(
        { error: "Simli is not configured yet. Add the Simli API key before starting Tina." },
        { status: 503 }
      );
    }

    const livekitConfig = getLiveKitConfig();
    const avatarSupport = getLiveAvatarSupport(livekitConfig.url);
    const supabase = await createServiceClient();
    const tutorContext = await loadTutorContext(supabase, {
      sessionId,
      kidSessionId,
      parentId,
      documentId,
    });

    const childName = tutorContext.childName?.trim() || "friend";
    const childAge = tutorContext.childAge || 10;
    const roomName = `vertex-${sessionId}`;
    const livekitHost = livekitConfig.url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    const dispatchMetadata = JSON.stringify({
      sessionId,
      kidSessionId: kidSessionId || null,
      parentId,
      childName,
      childAge,
      parentName: tutorContext.parentName,
      gradeLevel: tutorContext.gradeLevel,
      learningPace: tutorContext.learningPace,
      mathTopics: tutorContext.mathTopics,
      learningGoals: tutorContext.learningGoals,
      instructions: buildRealtimeTutorInstructions({
        childName,
        childAge,
        grade: tutorContext.gradeLevel || undefined,
        learningPace: tutorContext.learningPace || undefined,
        mathTopics: tutorContext.mathTopics,
        learningGoals: tutorContext.learningGoals || undefined,
        documentContext: tutorContext.documentContext || undefined,
      }),
    });

    const roomClient = new RoomServiceClient(
      livekitHost,
      livekitConfig.apiKey,
      livekitConfig.apiSecret
    );
    const dispatchClient = new AgentDispatchClient(
      livekitHost,
      livekitConfig.apiKey,
      livekitConfig.apiSecret
    );

    try {
      await roomClient.createRoom({ name: roomName, emptyTimeout: 10 * 60, departureTimeout: 2 * 60 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("already exists")) {
        console.warn("LiveKit createRoom warning:", error);
      }
    }

    try {
      const existingDispatches = await dispatchClient.listDispatch(roomName);
      const hasActiveDispatch = existingDispatches.some(
        (dispatch) => dispatch.agentName === livekitConfig.agentName
      );

      if (!hasActiveDispatch) {
        await dispatchClient.createDispatch(roomName, livekitConfig.agentName, {
          metadata: dispatchMetadata,
        });
      }
    } catch (error) {
      console.error("LiveKit agent dispatch error:", error);
      return NextResponse.json(
        { error: "Failed to dispatch Tina into the room" },
        { status: 500 }
      );
    }

    const token = new AccessToken(livekitConfig.apiKey, livekitConfig.apiSecret, {
      identity: `kid-${kidSessionId || sessionId}-${crypto.randomUUID().slice(0, 8)}`,
      name: childName,
      ttl: "30m",
      metadata: JSON.stringify({
        role: "child",
        kidSessionId: kidSessionId || null,
        sessionId,
        parentId,
      }),
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return NextResponse.json({
      token: await token.toJwt(),
      url: livekitConfig.url,
      roomName,
      tutorName: simliConfig.displayName,
      avatarVideoSupported: avatarSupport.supported,
      avatarVideoReason: avatarSupport.reason,
    });
  } catch (error) {
    console.error("LiveKit token error:", error);
    return NextResponse.json(
      { error: "Failed to start the live tutor" },
      { status: 500 }
    );
  }
}
