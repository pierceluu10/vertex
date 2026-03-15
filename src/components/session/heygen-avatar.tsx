"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface HeyGenAvatarProps {
  avatarName?: string;
  enableVoiceChat?: boolean;
  onAvatarReady?: () => void;
  onAvatarSpeaking?: (speaking: boolean) => void;
  onUserMessage?: (transcript: string) => void;
  onUserSpeaking?: (text: string) => void;
  onAvatarMessage?: (text: string) => void;
  speakQueue?: string | null;
  onSpeakComplete?: () => void;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StreamingAvatarInstance = any;

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 5000; // 5 seconds base for exponential backoff

export function HeyGenAvatar({
  avatarName,
  enableVoiceChat = true,
  onAvatarReady,
  onAvatarSpeaking,
  onUserMessage,
  onUserSpeaking,
  onAvatarMessage,
  speakQueue,
  onSpeakComplete,
  className,
}: HeyGenAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarRef = useRef<StreamingAvatarInstance | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initializingRef = useRef(false);
  const startedRef = useRef(false);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);

  const initAvatar = useCallback(async () => {
    if (initializingRef.current || avatarRef.current || !mountedRef.current) return;
    if (!avatarName) {
      setErrorMsg("No avatar configured. Create a video avatar in Parent Profile.");
      setStatus("error");
      return;
    }
    initializingRef.current = true;
    setStatus("loading");
    setErrorMsg(null);

    const effectiveAvatarName = avatarName;

    try {
      const tokenRes = await fetch("/api/heygen/token", { method: "POST" });
      const tokenData = await tokenRes.json();

      if (!mountedRef.current) return;

      if (!tokenData.token) {
        const errMessage = tokenData.error || "Failed to get HeyGen token";
        throw new Error(errMessage);
      }

      const mod = await import("@heygen/streaming-avatar");
      const StreamingAvatar = mod.default;
      const { StreamingEvents, AvatarQuality, VoiceEmotion } = mod;

      if (typeof StreamingAvatar !== "function") {
        throw new Error("HeyGen StreamingAvatar SDK could not be loaded. Run: npm install @heygen/streaming-avatar");
      }

      if (!mountedRef.current) return;

      const avatar = new StreamingAvatar({ token: tokenData.token });
      avatarRef.current = avatar;

      avatar.on(StreamingEvents.STREAM_READY, (event: { detail: MediaStream }) => {
        if (videoRef.current && mountedRef.current) {
          videoRef.current.srcObject = event.detail;
          videoRef.current.play().catch(() => {});
        }
        startedRef.current = true;
        retriesRef.current = 0; // Reset retries on success
        if (mountedRef.current) {
          setStatus("ready");
          onAvatarReady?.();
        }
      });

      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        onAvatarSpeaking?.(true);
      });

      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        onAvatarSpeaking?.(false);
        onSpeakComplete?.();
      });

      avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (msg: { detail: { message: string } }) => {
        if (msg?.detail?.message) {
          onAvatarMessage?.(msg.detail.message);
        }
      });

      avatar.on(StreamingEvents.USER_TALKING_MESSAGE, (msg: { detail: { message: string } }) => {
        if (msg?.detail?.message) {
          onUserSpeaking?.(msg.detail.message);
        }
      });

      avatar.on(StreamingEvents.USER_END_MESSAGE, (msg: { detail: { message: string } }) => {
        if (msg?.detail?.message) {
          onUserMessage?.(msg.detail.message);
        }
      });

      // Use parent's streaming avatar ID. Photo avatar IDs are NOT compatible with the streaming API.
      await avatar.createStartAvatar({
        avatarName: effectiveAvatarName,
        quality: AvatarQuality.Medium,
        language: "en",
        voice: {
          voiceId: "default",
          rate: 1.0,
          emotion: VoiceEmotion.FRIENDLY,
        },
        knowledgeBase:
          "You are a warm, encouraging parent tutor helping a child with math. Be patient, kind, and supportive.",
      });

      if (enableVoiceChat) {
        try {
          await avatar.startVoiceChat({});
        } catch {
          // Voice chat may not be available on all plans
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;

      const errObj = err as Error & { status?: number; code?: number };
      const msg = errObj?.message ? String(errObj.message) : "Failed to start avatar";
      const isRateLimit = msg.includes("429") || msg.includes("Too many requests");
      const is404 =
        errObj?.status === 404 ||
        errObj?.code === 404 ||
        msg.includes("404") ||
        msg.includes("Not Found");

      // Log 404 as warn so Next.js dev overlay doesn't show; log other errors
      if (is404) {
        console.warn("HeyGen avatar not found (404). Create a new video avatar in Parent Profile.", err);
      } else {
        console.error("HeyGen init error:", err);
      }

      if (isRateLimit && retriesRef.current < MAX_RETRIES) {
        // Exponential backoff: 5s, 10s, 20s
        const delay = BASE_RETRY_DELAY * Math.pow(2, retriesRef.current);
        retriesRef.current++;
        console.log(`HeyGen rate limited. Retry ${retriesRef.current}/${MAX_RETRIES} in ${delay / 1000}s`);
        setErrorMsg(`Too many requests. Retrying in ${Math.round(delay / 1000)}s... (${retriesRef.current}/${MAX_RETRIES})`);
        setStatus("loading");
        initializingRef.current = false;
        // Clean up partial state before retry
        if (avatarRef.current && !startedRef.current) {
          avatarRef.current = null;
        }
        setTimeout(() => {
          if (mountedRef.current) initAvatar();
        }, delay);
        return;
      }

      setErrorMsg(
        isRateLimit
          ? `Rate limit reached after ${MAX_RETRIES} retries. Wait a minute, then click Retry.`
          : msg.includes("401")
          ? "Authentication failed. Check your HeyGen API key."
          : is404
          ? "Avatar not found. Create a new video avatar in Parent Profile (training + consent videos)."
          : msg
      );
      setStatus("error");
      initializingRef.current = false;
    }
  }, [avatarName, enableVoiceChat, onAvatarReady, onAvatarSpeaking, onUserMessage, onUserSpeaking, onAvatarMessage, onSpeakComplete]);

  // Lazy init: only start when component mounts, clean up on unmount
  useEffect(() => {
    mountedRef.current = true;

    // Small delay to avoid double-mount in React dev strict mode
    const timer = setTimeout(() => {
      if (mountedRef.current) initAvatar();
    }, 500);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      // Only call stopAvatar if the session actually reached STREAM_READY
      if (avatarRef.current && startedRef.current) {
        avatarRef.current.stopAvatar().catch(() => {});
      }
      avatarRef.current = null;
      startedRef.current = false;
      initializingRef.current = false;
    };
  }, [initAvatar]);

  useEffect(() => {
    if (!speakQueue || !avatarRef.current || status !== "ready") return;

    const doSpeak = async () => {
      try {
        const { TaskType } = await import("@heygen/streaming-avatar");
        await avatarRef.current!.speak({
          text: speakQueue,
          taskType: TaskType.REPEAT,
        });
      } catch (err) {
        console.error("HeyGen speak error:", err);
        onSpeakComplete?.();
      }
    };
    doSpeak();
  }, [speakQueue, status, onSpeakComplete]);

  const handleRetry = useCallback(() => {
    initializingRef.current = false;
    retriesRef.current = 0;
    setStatus("idle");
    setErrorMsg(null);
    // Clean up any partial avatar state
    if (avatarRef.current && !startedRef.current) {
      avatarRef.current = null;
    }
    setTimeout(() => initAvatar(), 3000);
  }, [initAvatar]);

  if (status === "error") {
    return (
      <div className={className} style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "rgba(158,107,117,0.06)", borderRadius: 8, padding: 20, textAlign: "center",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%", background: "rgba(200,65,106,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
          border: "1.5px solid rgba(158,107,117,0.2)",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c8416a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <p style={{ fontSize: 11, color: "#8a7f6e", maxWidth: 180 }}>
          {errorMsg || "Avatar unavailable"}
        </p>
        <button
          onClick={handleRetry}
          style={{
            marginTop: 8, fontSize: 10, color: "#c8416a", background: "none",
            border: "1px solid rgba(158,107,117,0.25)", borderRadius: 3, padding: "6px 12px",
            cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase" as const,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden", borderRadius: 8 }}>
      {(status === "loading") && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", background: "rgba(244,239,229,0.9)", zIndex: 2,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 32, height: 32, border: "2px solid rgba(158,107,117,0.2)",
              borderTopColor: "#c8416a", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 8px",
            }} />
            <p style={{ fontSize: 11, color: "#8a7f6e" }}>
              {errorMsg || "Loading tutor..."}
            </p>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
