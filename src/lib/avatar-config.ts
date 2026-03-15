const LOCAL_LIVEKIT_URL = "ws://127.0.0.1:7880";
const LOCAL_LIVEKIT_API_KEY = "devkey";
const LOCAL_LIVEKIT_API_SECRET = "secret";

export const DEFAULT_SIMLI_FACE_ID = "cace3ef7-a4c4-425d-a8cf-a5358eb0c427";
export const DEFAULT_TUTOR_AVATAR_NAME = "Tina";

export interface LiveAvatarSupport {
  supported: boolean;
  reason: string | null;
}

export function getSimliAvatarConfig() {
  const faceId =
    process.env.SIMLI_FACE_ID?.trim() ||
    process.env.NEXT_PUBLIC_SIMLI_FACE_ID?.trim() ||
    DEFAULT_SIMLI_FACE_ID;

  return {
    displayName:
      process.env.NEXT_PUBLIC_TUTOR_AVATAR_NAME?.trim() || DEFAULT_TUTOR_AVATAR_NAME,
    faceId,
    ready: Boolean(process.env.SIMLI_API_KEY?.trim() && faceId),
  };
}

export function getLiveKitConfig() {
  const url =
    process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() ||
    process.env.LIVEKIT_URL?.trim() ||
    LOCAL_LIVEKIT_URL;

  return {
    url,
    apiKey: process.env.LIVEKIT_API_KEY?.trim() || LOCAL_LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET?.trim() || LOCAL_LIVEKIT_API_SECRET,
    agentName: process.env.LIVEKIT_AGENT_NAME?.trim() || "vertex-tina-tutor",
  };
}

export function getLiveAvatarSupport(url: string): LiveAvatarSupport {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local");

    if (parsed.protocol !== "wss:") {
      return {
        supported: false,
        reason:
          "Tina's live face needs a public LiveKit room URL over wss:// so Simli can join and publish video.",
      };
    }

    if (isLocalHost) {
      return {
        supported: false,
        reason:
          "Tina's live face cannot join a local LiveKit room. Point LiveKit to a public wss:// endpoint to show the avatar video.",
      };
    }

    return { supported: true, reason: null };
  } catch {
    return {
      supported: false,
      reason:
        "The LiveKit URL is invalid. Use a public wss:// LiveKit room URL for the Simli avatar video.",
    };
  }
}
