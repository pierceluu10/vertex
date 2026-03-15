import { NextResponse } from "next/server";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import { AccessToken } from "livekit-server-sdk";
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

    token.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: livekitConfig.agentName,
          metadata: JSON.stringify({
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
          }),
        }),
      ],
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
