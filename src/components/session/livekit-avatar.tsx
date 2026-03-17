"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AudioCaptureOptions,
  ConnectionState,
  LocalTrackPublication,
  Participant,
  RemoteParticipant,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  type TranscriptionSegment,
} from "livekit-client";

type LiveKitAvatarStatus = "idle" | "connecting" | "ready" | "audio-only" | "error";

export interface LiveTranscriptEntry {
  role: "user" | "assistant";
  text: string;
}

interface AgentPromptRequest {
  id: number;
  text: string;
}

interface LiveKitAvatarProps {
  sessionId?: string | null;
  kidSessionId?: string | null;
  parentId?: string | null;
  documentId?: string | null;
  micEnabled?: boolean;
  cameraEnabled?: boolean;
  childName?: string | null;
  className?: string;
  onAvatarReady?: () => void;
  onTranscript?: (entry: LiveTranscriptEntry) => void;
  agentPromptRequest?: AgentPromptRequest | null;
}

interface RemoteTrackState {
  audio: boolean;
  video: boolean;
}

interface RemotePresenceState {
  agent: boolean;
  avatar: boolean;
}

const MIC_CAPTURE_OPTIONS: AudioCaptureOptions = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  voiceIsolation: true,
};

export function LiveKitAvatar({
  sessionId,
  kidSessionId,
  parentId,
  documentId,
  micEnabled = false,
  cameraEnabled = false,
  childName,
  className,
  onAvatarReady,
  onTranscript,
  agentPromptRequest,
}: LiveKitAvatarProps) {
  const roomRef = useRef<Room | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const mountedRef = useRef(true);
  const readyRef = useRef(false);
  const micEnabledRef = useRef(micEnabled);
  const cameraEnabledRef = useRef(cameraEnabled);
  const avatarVideoSupportedRef = useRef(true);
  const avatarVideoReasonRef = useRef<string | null>(null);
  const seenTranscriptIdsRef = useRef<Set<string>>(new Set());
  const suppressedAgentTranscriptUntilRef = useRef(0);
  const lastAgentPromptIdRef = useRef<number | null>(null);
  const pendingAgentPromptRef = useRef<AgentPromptRequest | null>(null);
  const remoteTrackStateRef = useRef<RemoteTrackState>({ audio: false, video: false });
  const remotePresenceRef = useRef<RemotePresenceState>({ agent: false, avatar: false });
  const remoteElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const localElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const connectionTimeoutRef = useRef<number | null>(null);
  const remoteScanIntervalRef = useRef<number | null>(null);
  const remoteVideoLossTimeoutRef = useRef<number | null>(null);

  const remoteVideoHostRef = useRef<HTMLDivElement>(null);
  const remoteAudioHostRef = useRef<HTMLDivElement>(null);
  const localVideoHostRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<LiveKitAvatarStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [subtitleText, setSubtitleText] = useState("");
  const subtitleTimeoutRef = useRef<number | null>(null);
  const tutorName = process.env.NEXT_PUBLIC_TUTOR_AVATAR_NAME || "Pierce";
  const tutorInitial = tutorName.trim().slice(0, 1).toUpperCase() || "P";

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    cameraEnabledRef.current = cameraEnabled;
  }, [cameraEnabled]);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const isAgentParticipant = useCallback((participant: Participant) => {
    return (
      Boolean(participant.attributes?.lkAgentName) ||
      participant.identity?.startsWith("agent-") ||
      participant.identity?.startsWith("simli-avatar-")
    );
  }, []);

  const updateRemotePresence = useCallback(
    (room: Room) => {
      let agent = false;
      let avatar = false;

      room.remoteParticipants.forEach((participant) => {
        if (participant.identity?.startsWith("simli-avatar-")) {
          avatar = true;
        }

        if (isAgentParticipant(participant)) {
          agent = true;
        }
      });

      remotePresenceRef.current = { agent, avatar };
    },
    [isAgentParticipant]
  );

  const detachElement = useCallback((store: Map<string, HTMLElement>, key: string) => {
    const element = store.get(key);
    if (element) {
      element.remove();
      store.delete(key);
    }
  }, []);

  const detachVideoElements = useCallback((store: Map<string, HTMLElement>) => {
    for (const [key, element] of store.entries()) {
      if (element instanceof HTMLVideoElement) {
        element.remove();
        store.delete(key);
      }
    }
  }, []);

  const attachTrackElement = useCallback(
    (track: Track, key: string, host: HTMLDivElement | null, store: Map<string, HTMLElement>) => {
      if (!host) return;

      detachElement(store, key);

      const element = track.attach();
      element.autoplay = true;

      if (track.kind === Track.Kind.Video) {
        const videoElement = element as HTMLVideoElement;
        videoElement.playsInline = true;
        Object.assign(videoElement.style, {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        });
      } else {
        element.style.display = "none";
      }

      host.appendChild(element);
      store.set(key, element);
    },
    [detachElement]
  );

  const updateStatusFromTracks = useCallback(
    (fallback?: string) => {
      const remoteTracks = remoteTrackStateRef.current;
      const remotePresence = remotePresenceRef.current;

      if (remoteTracks.video) {
        if (!readyRef.current) {
          readyRef.current = true;
          onAvatarReady?.();
        }

        setStatus("ready");
        setErrorMsg(null);
        return;
      }

      if (remoteTracks.audio) {
        setStatus("audio-only");
        setErrorMsg(
          avatarVideoSupportedRef.current
            ? fallback ||
                `${tutorName}'s voice is connected, but Simli has not published a video track to this LiveKit room.`
            : avatarVideoReasonRef.current ||
                `${tutorName}'s live face needs a public wss:// LiveKit room so Simli can join and publish video.`
        );
        return;
      }

      if (remotePresence.agent || remotePresence.avatar) {
        setStatus("connecting");
        setErrorMsg(
          remotePresence.avatar
            ? `${tutorName} joined the room and is getting the live face ready.`
            : `${tutorName} is joining the room now.`
        );
        return;
      }

      setStatus("connecting");
      setErrorMsg(null);
    },
    [onAvatarReady]
  );

  const attachRemoteTrack = useCallback(
    (track: Track, key: string) => {
      if (track.kind === Track.Kind.Video && remoteVideoLossTimeoutRef.current) {
        window.clearTimeout(remoteVideoLossTimeoutRef.current);
        remoteVideoLossTimeoutRef.current = null;
      }

      const host =
        track.kind === Track.Kind.Video ? remoteVideoHostRef.current : remoteAudioHostRef.current;

      // Attach new track BEFORE detaching old ones to prevent blank flash
      attachTrackElement(track, key, host, remoteElementsRef.current);

      if (track.kind === Track.Kind.Video) {
        // Clean up any stale video elements (not the one we just attached)
        const justAttached = remoteElementsRef.current.get(key);
        remoteElementsRef.current.forEach((element, elementKey) => {
          if (element instanceof HTMLVideoElement && element !== justAttached) {
            element.remove();
            remoteElementsRef.current.delete(elementKey);
          }
        });
        remoteTrackStateRef.current.video = true;
      }

      if (track.kind === Track.Kind.Audio) {
        remoteTrackStateRef.current.audio = true;
      }

      updateStatusFromTracks();
    },
    [attachTrackElement, updateStatusFromTracks]
  );

  const attachLocalTrack = useCallback(
    (track: Track, key: string) => {
      if (track.kind !== Track.Kind.Video) return;
      attachTrackElement(track, key, localVideoHostRef.current, localElementsRef.current);
      setCameraActive(true);
      setCameraError(null);
    },
    [attachTrackElement]
  );

  const detachRemoteTrack = useCallback(
    (track: Track, key: string) => {
      if (track.kind === Track.Kind.Video) {
        if (remoteVideoLossTimeoutRef.current) {
          window.clearTimeout(remoteVideoLossTimeoutRef.current);
        }

        remoteVideoLossTimeoutRef.current = window.setTimeout(() => {
          detachVideoElements(remoteElementsRef.current);
          remoteTrackStateRef.current.video = false;
          remoteVideoLossTimeoutRef.current = null;
          updateStatusFromTracks();
        }, 1500);
        return;
      }

      detachElement(remoteElementsRef.current, key);

      if (track.kind === Track.Kind.Audio) {
        remoteTrackStateRef.current.audio = false;
        updateStatusFromTracks();
      }
    },
    [detachElement, detachVideoElements, updateStatusFromTracks]
  );

  const detachLocalTrack = useCallback(
    (key: string) => {
      detachElement(localElementsRef.current, key);
      setCameraActive(false);
    },
    [detachElement]
  );

  const ensureRemotePublication = useCallback(
    (publication: RemoteTrackPublication) => {
      if (publication.kind !== Track.Kind.Video && publication.kind !== Track.Kind.Audio) {
        return;
      }

      publication.setSubscribed(true);

      if (publication.track) {
        const key = publication.trackSid || publication.track.sid || publication.kind;
        attachRemoteTrack(publication.track, key);
      }
    },
    [attachRemoteTrack]
  );

  const scanRemoteParticipant = useCallback(
    (participant: RemoteParticipant) => {
      // Only pull in tracks from the AI agent/avatar participant
      if (!isAgentParticipant(participant)) return;
      participant.trackPublications.forEach((publication) => {
        ensureRemotePublication(publication as RemoteTrackPublication);
      });
    },
    [ensureRemotePublication, isAgentParticipant]
  );

  const syncMicState = useCallback(async (room: Room, nextMicEnabled: boolean) => {
    try {
      const localParticipant = room.localParticipant;
      await localParticipant.setMicrophoneEnabled(nextMicEnabled, MIC_CAPTURE_OPTIONS);

      if (!nextMicEnabled) {
        const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        const micTrack = micPublication?.track;

        if (micTrack) {
          micTrack.mediaStreamTrack.enabled = false;
          micTrack.stop();
          if (micPublication.track) {
            await localParticipant.unpublishTrack(micPublication.track, false);
          }
        }
      }
    } catch (error) {
      console.warn("LiveKit mic toggle failed:", error);
      setErrorMsg(`Microphone access was blocked. Allow mic access to talk with ${tutorName}.`);
    }
  }, []);

  const syncCameraState = useCallback(
    async (room: Room, nextCameraEnabled: boolean) => {
      try {
        const localParticipant = room.localParticipant;
        await localParticipant.setCameraEnabled(nextCameraEnabled);

        if (!nextCameraEnabled) {
          const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
          const cameraTrack = cameraPublication?.track;

          if (cameraTrack) {
            cameraTrack.mediaStreamTrack.enabled = false;
            cameraTrack.stop();
            if (cameraPublication.track) {
              await localParticipant.unpublishTrack(cameraPublication.track, false);
            }
          }

          localElementsRef.current.forEach((element) => element.remove());
          localElementsRef.current.clear();
          setCameraActive(false);
        }
      } catch (error) {
        console.warn("LiveKit camera toggle failed:", error);
        setCameraError("Camera access was blocked. Allow camera access to show your video.");
      }
    },
    []
  );

  const handleTranscription = useCallback(
    (segments: TranscriptionSegment[], participant?: Participant) => {
      const isAgent =
        Boolean(participant?.attributes?.lkAgentName) ||
        participant?.identity?.startsWith("agent-");

      // Update subtitles for assistant speech (interim + final)
      if (isAgent) {
        const subtitleContent = segments
          .map((segment) => segment.text.trim())
          .filter(Boolean)
          .join(" ")
          .trim();

        if (subtitleContent) {
          setSubtitleText(subtitleContent);
          if (subtitleTimeoutRef.current) window.clearTimeout(subtitleTimeoutRef.current);
          subtitleTimeoutRef.current = window.setTimeout(() => {
            setSubtitleText("");
            subtitleTimeoutRef.current = null;
          }, 3000);
        }
      }

      // Emit final segments via onTranscript (existing behavior)
      const freshFinalSegments = segments.filter((segment) => {
        if (!segment.final || seenTranscriptIdsRef.current.has(segment.id)) {
          return false;
        }

        seenTranscriptIdsRef.current.add(segment.id);
        return true;
      });

      if (!freshFinalSegments.length) return;

      const text = freshFinalSegments
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!text) return;

      if (isAgent && Date.now() < suppressedAgentTranscriptUntilRef.current) {
        return;
      }

      onTranscriptRef.current?.({
        role: isAgent ? "assistant" : "user",
        text,
      });
    },
    []
  );

  const flushPendingAgentPrompt = useCallback(async () => {
    const room = roomRef.current;
    const prompt = pendingAgentPromptRef.current;

    if (!room || !prompt) return;
    if (room.state !== ConnectionState.Connected) return;
    if (lastAgentPromptIdRef.current === prompt.id) {
      pendingAgentPromptRef.current = null;
      return;
    }

    try {
      suppressedAgentTranscriptUntilRef.current = Date.now() + 12000;
      await room.localParticipant.sendChatMessage(prompt.text);
      lastAgentPromptIdRef.current = prompt.id;
      pendingAgentPromptRef.current = null;
    } catch (error) {
      console.warn("Hidden agent prompt failed:", error);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    readyRef.current = false;
    remoteTrackStateRef.current = { audio: false, video: false };
    remotePresenceRef.current = { agent: false, avatar: false };
    setCameraActive(false);
    setCameraError(null);
    let cancelled = false;

    if (!sessionId || !parentId) {
      setStatus("idle");
      setErrorMsg("Live tutor details are missing.");
      return;
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: MIC_CAPTURE_OPTIONS,
    });

    roomRef.current = room;
    setStatus("connecting");
    setErrorMsg(null);

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      // Only accept video tracks from the AI agent/avatar — never the student's own camera
      if (track.kind === Track.Kind.Video && !isAgentParticipant(participant)) return;
      const key = publication.trackSid || track.sid || publication.kind;
      attachRemoteTrack(track, key);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication) => {
      const key = publication.trackSid || track.sid || publication.kind;
      detachRemoteTrack(track, key);
    });

    room.on(RoomEvent.TrackPublished, (publication, participant) => {
      if (participant instanceof RemoteParticipant) {
        updateRemotePresence(room);
        // Only subscribe to video/audio from the AI agent, not from other participants
        if (isAgentParticipant(participant)) {
          ensureRemotePublication(publication as RemoteTrackPublication);
        }
      }
    });

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      updateRemotePresence(room);
      scanRemoteParticipant(participant);
      updateStatusFromTracks();
    });

    room.on(RoomEvent.ParticipantDisconnected, () => {
      updateRemotePresence(room);
      updateStatusFromTracks();
    });

    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      const localPublication = publication as LocalTrackPublication;
      if (
        localPublication.kind === Track.Kind.Video &&
        localPublication.source === Track.Source.Camera &&
        localPublication.track
      ) {
        const key = localPublication.trackSid || localPublication.track.sid || "local-camera";
        attachLocalTrack(localPublication.track, key);
      }
    });

    room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (
        publication.kind === Track.Kind.Video &&
        publication.source === Track.Source.Camera
      ) {
        const key = publication.trackSid || publication.track?.sid || "local-camera";
        detachLocalTrack(key);
      }
    });

    room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
      handleTranscription(segments, participant);
    });

    room.on(RoomEvent.Disconnected, () => {
      if (!mountedRef.current) return;
      readyRef.current = false;
      remoteTrackStateRef.current = { audio: false, video: false };
      remotePresenceRef.current = { agent: false, avatar: false };
      setCameraActive(false);
      setStatus("error");
      setErrorMsg(`${tutorName} disconnected from the call. Refresh to reconnect.`);
    });

    const connect = async () => {
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            kidSessionId,
            parentId,
            documentId,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token || !data.url) {
          throw new Error(data.error || `Failed to start ${tutorName}.`);
        }

        if (cancelled || !mountedRef.current) {
          room.disconnect();
          return;
        }

        avatarVideoSupportedRef.current = data.avatarVideoSupported !== false;
        avatarVideoReasonRef.current =
          typeof data.avatarVideoReason === "string" ? data.avatarVideoReason : null;

        await room.connect(data.url, data.token);

        if (cancelled || !mountedRef.current) {
          room.disconnect();
          return;
        }

        await syncMicState(room, micEnabledRef.current);
        await syncCameraState(room, cameraEnabledRef.current);

        updateRemotePresence(room);
        room.remoteParticipants.forEach((participant) => {
          scanRemoteParticipant(participant);
        });
        updateStatusFromTracks();

        await flushPendingAgentPrompt();

        connectionTimeoutRef.current = window.setTimeout(() => {
          if (!mountedRef.current || remoteTrackStateRef.current.video) return;

          if (remoteTrackStateRef.current.audio) {
            updateStatusFromTracks();
            return;
          }

          updateRemotePresence(room);
          if (remotePresenceRef.current.avatar) {
            setStatus("connecting");
            setErrorMsg(
              `${tutorName} is in the room; Simli may still be publishing video. Wait a bit longer or check agent logs.`
            );
            return;
          }

          if (remotePresenceRef.current.agent) {
            setStatus("error");
            setErrorMsg(
              `${tutorName}'s agent joined, but the Simli avatar did not publish media. Check SIMLI_API_KEY, SIMLI_FACE_ID, and the worker logs.`
            );
            return;
          }

          setStatus("error");
          const noParticipants = room.remoteParticipants.size === 0;
          setErrorMsg(
            !avatarVideoSupportedRef.current
              ? avatarVideoReasonRef.current ||
                  `${tutorName}'s live face needs a public wss:// LiveKit room to show video.`
              : noParticipants
                ? `The tutor agent did not join the room. Make sure the agent worker is running (e.g. \`npm run agent:simli\`) and LIVEKIT_AGENT_NAME matches.`
                : `${tutorName} joined but the video feed did not start. Check the agent terminal for Simli errors, or refresh to retry.`
          );
        }, 12000);

        remoteScanIntervalRef.current = window.setInterval(() => {
          if (!mountedRef.current || room.state !== ConnectionState.Connected) return;
          updateRemotePresence(room);
          room.remoteParticipants.forEach((participant) => {
            scanRemoteParticipant(participant);
          });
          updateStatusFromTracks();
        }, 1500);
      } catch (error) {
        console.error("LiveKit avatar connection error:", error);
        if (!mountedRef.current) return;
        setStatus("error");
        setErrorMsg(
          error instanceof Error ? error.message : `Could not connect to ${tutorName} right now.`
        );
      }
    };

    void connect();

    const remoteElements = remoteElementsRef.current;
    const localElements = localElementsRef.current;

    return () => {
      cancelled = true;
      mountedRef.current = false;

      if (connectionTimeoutRef.current) {
        window.clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      if (remoteScanIntervalRef.current) {
        window.clearInterval(remoteScanIntervalRef.current);
        remoteScanIntervalRef.current = null;
      }
      if (remoteVideoLossTimeoutRef.current) {
        window.clearTimeout(remoteVideoLossTimeoutRef.current);
        remoteVideoLossTimeoutRef.current = null;
      }
      if (subtitleTimeoutRef.current) {
        window.clearTimeout(subtitleTimeoutRef.current);
        subtitleTimeoutRef.current = null;
      }

      remoteElements.forEach((element) => element.remove());
      remoteElements.clear();
      localElements.forEach((element) => element.remove());
      localElements.clear();

      const currentRoom = roomRef.current;
      roomRef.current = null;

      if (currentRoom) {
        currentRoom.localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
        currentRoom.localParticipant.setCameraEnabled(false).catch(() => undefined);
        currentRoom.disconnect();
      }
    };
  }, [
    attachLocalTrack,
    attachRemoteTrack,
    detachLocalTrack,
    detachRemoteTrack,
    documentId,
    ensureRemotePublication,
    kidSessionId,
    handleTranscription,
    parentId,
    scanRemoteParticipant,
    sessionId,
    syncCameraState,
    syncMicState,
    updateRemotePresence,
    updateStatusFromTracks,
    flushPendingAgentPrompt,
  ]);

  useEffect(() => {
    if (!agentPromptRequest) return;
    if (lastAgentPromptIdRef.current === agentPromptRequest.id) return;

    pendingAgentPromptRef.current = agentPromptRequest;
    void flushPendingAgentPrompt();
  }, [agentPromptRequest, flushPendingAgentPrompt]);

  useEffect(() => {
    if (!roomRef.current || status === "idle") return;
    void syncMicState(roomRef.current, micEnabled);
  }, [micEnabled, status, syncMicState]);

  useEffect(() => {
    if (!roomRef.current || status === "idle") return;
    void syncCameraState(roomRef.current, cameraEnabled);
  }, [cameraEnabled, status, syncCameraState]);

  const overlayTitle =
    status === "ready"
      ? null
      : status === "audio-only"
      ? `${tutorName} is on voice`
    : status === "connecting"
      ? `Connecting ${tutorName}...`
      : `${tutorName} is offline`;

  const overlayBody =
    status === "ready"
      ? null
      : status === "audio-only"
      ? errorMsg
      : status === "connecting"
      ? errorMsg || `Joining the LiveKit room and waiting for ${tutorName}'s video feed.`
      : errorMsg || "The live tutor could not start right now.";

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 320,
        overflow: "hidden",
        borderRadius: 24,
        background:
          "#1d2431",
        boxShadow: "0 24px 44px rgba(17, 23, 35, 0.18)",
      }}
    >
      <div
        ref={remoteVideoHostRef}
        style={{ width: "100%", height: "100%", background: "rgba(17,23,35,0.92)" }}
      />
      <div ref={remoteAudioHostRef} aria-hidden="true" />

      {status !== "ready" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
            background:
              status === "audio-only"
                ? "rgba(15,21,32,0.72)"
                : "rgba(10,14,24,0.82)",
            color: "#f7efe2",
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background:
                status === "audio-only"
                  ? "rgba(92, 124, 106, 0.28)"
                  : "rgba(90, 224, 86, 0.15)",
              border:
                status === "audio-only"
                  ? "1px solid rgba(92, 124, 106, 0.55)"
                  : "1px solid rgba(90, 224, 86, 0.24)",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            {tutorInitial}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{overlayTitle}</div>
          <div
            style={{
              maxWidth: 420,
              fontSize: 13,
              lineHeight: 1.65,
              color: "rgba(247,239,226,0.8)",
            }}
          >
            {overlayBody}
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 999,
          background: "rgba(8, 12, 18, 0.48)",
          color: "#fff6eb",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background:
              status === "ready"
                ? "#78d98d"
                : status === "audio-only"
                ? "#d7b15a"
                : "#f0d8b6",
            boxShadow:
              status === "ready"
                ? "0 0 18px rgba(120,217,141,0.75)"
                : status === "audio-only"
                ? "0 0 18px rgba(215,177,90,0.65)"
                : "none",
          }}
        />
        {status === "ready" ? `Live with ${tutorName}` : status === "audio-only" ? "Voice only" : "Connecting"}
      </div>

      {subtitleText && (
        <div
          style={{
            position: "absolute",
            bottom: "clamp(228px, 35%, 300px)",
            left: 16,
            right: 180,
            padding: "8px 14px",
            borderRadius: 12,
            background: "rgba(0, 0, 0, 0.65)",
            color: "#fff",
            fontSize: 15,
            lineHeight: 1.5,
            backdropFilter: "blur(6px)",
            pointerEvents: "none",
            maxWidth: "70%",
          }}
        >
          {subtitleText}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          width: 150,
          aspectRatio: "3 / 4",
          borderRadius: 18,
          overflow: "hidden",
          background: "rgba(9, 13, 19, 0.92)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 18px 30px rgba(0, 0, 0, 0.24)",
        }}
      >
        <div ref={localVideoHostRef} style={{ width: "100%", height: "100%" }} />
        {!cameraActive && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 14,
              background: "rgba(9,13,19,0.88)",
              color: "#f8ecdc",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,0.08)",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {(childName?.trim() || "K").slice(0, 1).toUpperCase()}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>Your camera is off</div>
            <div style={{ fontSize: 10, lineHeight: 1.45, color: "rgba(248,236,220,0.75)" }}>
              {cameraError || `Turn the camera on if you want ${tutorName} to see you like a call.`}
            </div>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: 10,
            bottom: 10,
            padding: "6px 8px",
            borderRadius: 999,
            background: "rgba(8,12,18,0.58)",
            color: "#fff6eb",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          You
        </div>
      </div>
    </div>
  );
}
