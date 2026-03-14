"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface HeyGenAvatarProps {
  onAvatarReady?: () => void;
  onAvatarSpeaking?: (speaking: boolean) => void;
  onUserMessage?: (transcript: string) => void;
  speakQueue?: string | null;
  onSpeakComplete?: () => void;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StreamingAvatarInstance = any;

export function HeyGenAvatar({
  onAvatarReady,
  onAvatarSpeaking,
  onUserMessage,
  speakQueue,
  onSpeakComplete,
  className,
}: HeyGenAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarRef = useRef<StreamingAvatarInstance | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initializingRef = useRef(false);

  const initAvatar = useCallback(async () => {
    if (initializingRef.current || avatarRef.current) return;
    initializingRef.current = true;
    setStatus("loading");

    try {
      const tokenRes = await fetch("/api/heygen/token", { method: "POST" });
      const tokenData = await tokenRes.json();

      if (!tokenData.token) {
        throw new Error(tokenData.error || "Failed to get HeyGen token");
      }

      const mod = await import("@heygen/streaming-avatar");
      const StreamingAvatar = mod.default;
      const { StreamingEvents, AvatarQuality, VoiceEmotion } = mod;

      if (typeof StreamingAvatar !== "function") {
        throw new Error("HeyGen StreamingAvatar SDK could not be loaded. Run: npm install @heygen/streaming-avatar");
      }

      const avatar = new StreamingAvatar({ token: tokenData.token });
      avatarRef.current = avatar;

      avatar.on(StreamingEvents.STREAM_READY, (event: { detail: MediaStream }) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.detail;
          videoRef.current.play().catch(() => {});
        }
        setStatus("ready");
        onAvatarReady?.();
      });

      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        onAvatarSpeaking?.(true);
      });

      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        onAvatarSpeaking?.(false);
        onSpeakComplete?.();
      });

      avatar.on(StreamingEvents.USER_END_MESSAGE, (msg: { detail: { message: string } }) => {
        if (msg?.detail?.message) {
          onUserMessage?.(msg.detail.message);
        }
      });

      await avatar.createStartAvatar({
        avatarName: "default",
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

      try {
        await avatar.startVoiceChat({});
      } catch {
        // Voice chat may not be available on all plans
      }
    } catch (err) {
      console.error("HeyGen init error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to start avatar");
      setStatus("error");
      initializingRef.current = false;
    }
  }, [onAvatarReady, onAvatarSpeaking, onUserMessage, onSpeakComplete]);

  useEffect(() => {
    initAvatar();

    return () => {
      if (avatarRef.current) {
        avatarRef.current.stopAvatar().catch(() => {});
        avatarRef.current = null;
      }
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

  if (status === "error") {
    return (
      <div className={className} style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "rgba(200,65,106,0.06)", borderRadius: 8, padding: 20, textAlign: "center",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%", background: "rgba(200,65,106,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
          border: "1.5px solid rgba(200,65,106,0.2)",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c8416a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <p style={{ fontSize: 11, color: "#8a7f6e", maxWidth: 180 }}>
          {errorMsg || "Avatar unavailable"}
        </p>
        <button
          onClick={() => { initializingRef.current = false; setStatus("idle"); initAvatar(); }}
          style={{
            marginTop: 8, fontSize: 10, color: "#c8416a", background: "none",
            border: "1px solid rgba(200,65,106,0.3)", borderRadius: 3, padding: "6px 12px",
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
      {status === "loading" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", background: "rgba(244,239,229,0.9)", zIndex: 2,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 32, height: 32, border: "2px solid rgba(200,65,106,0.2)",
              borderTopColor: "#c8416a", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 8px",
            }} />
            <p style={{ fontSize: 11, color: "#8a7f6e" }}>Loading tutor...</p>
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
