"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export interface WebcamAttentionState {
  facePresent: boolean;
  lookingAway: boolean;
  headTurned: boolean;
  webcamEnabled: boolean;
  permissionDenied: boolean;
  stream: MediaStream | null;
}

export function useWebcamAttention(
  enabled: boolean,
  onFaceEvent: (event: "FACE_PRESENT" | "NO_FACE" | "LOOKING_AWAY" | "HEAD_TURNED") => void
) {
  const [state, setState] = useState<WebcamAttentionState>({
    facePresent: true,
    lookingAway: false,
    headTurned: false,
    webcamEnabled: false,
    permissionDenied: false,
    stream: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<unknown>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noFaceSinceRef = useRef<number | null>(null);
  const lookingAwaySinceRef = useRef<number | null>(null);

  const FACE_ABSENT_GRACE_MS = 3000;
  const LOOKING_AWAY_GRACE_MS = 4000;
  const CHECK_INTERVAL_MS = 1500;

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    videoRef.current = null;
    setState((prev) => ({ ...prev, webcamEnabled: false, stream: null }));
  }, []);

  const startWebcam = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
      streamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      videoRef.current = video;

      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      canvasRef.current = canvas;

      setState((prev) => ({
        ...prev,
        webcamEnabled: true,
        permissionDenied: false,
        stream,
      }));
    } catch {
      setState((prev) => ({ ...prev, permissionDenied: true, webcamEnabled: false, stream: null }));
    }
  }, []);

  const detectFace = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 320, 240);

    try {
      const { FaceDetector } = await import("@mediapipe/tasks-vision");

      if (!detectorRef.current) {
        const vision = await (FaceDetector as unknown as { createFromOptions: (wasmFileset: unknown, options: unknown) => Promise<unknown> }).createFromOptions(
          {
            wasmLoaderPath: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.js",
            wasmBinaryPath: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.wasm",
          },
          {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            },
            runningMode: "IMAGE",
          }
        );
        detectorRef.current = vision;
      }

      const detector = detectorRef.current as { detect: (image: HTMLCanvasElement) => { detections: Array<{ boundingBox: { originX: number; originY: number; width: number; height: number } }> } };
      const result = detector.detect(canvas);
      const faces = result.detections || [];

      const now = Date.now();

      if (faces.length === 0) {
        if (!noFaceSinceRef.current) {
          noFaceSinceRef.current = now;
        } else if (now - noFaceSinceRef.current > FACE_ABSENT_GRACE_MS) {
          setState((prev) => ({ ...prev, facePresent: false }));
          onFaceEvent("NO_FACE");
        }
        lookingAwaySinceRef.current = null;
      } else {
        noFaceSinceRef.current = null;
        const face = faces[0];
        const box = face.boundingBox;
        const centerX = box.originX + box.width / 2;
        const frameCenter = 160;

        const isOffCenter = Math.abs(centerX - frameCenter) > 80;

        if (isOffCenter) {
          if (!lookingAwaySinceRef.current) {
            lookingAwaySinceRef.current = now;
          } else if (now - lookingAwaySinceRef.current > LOOKING_AWAY_GRACE_MS) {
            setState((prev) => ({ ...prev, lookingAway: true, facePresent: true }));
            onFaceEvent("LOOKING_AWAY");
          }
        } else {
          if (lookingAwaySinceRef.current || !state.facePresent) {
            onFaceEvent("FACE_PRESENT");
          }
          lookingAwaySinceRef.current = null;
          setState((prev) => ({
            ...prev,
            facePresent: true,
            lookingAway: false,
            headTurned: false,
          }));
        }
      }
    } catch {
      // MediaPipe unavailable; webcam attention degrades gracefully
    }
  }, [onFaceEvent, state.facePresent]);

  useEffect(() => {
    if (enabled) {
      startWebcam();
    } else {
      stopWebcam();
    }

    return () => {
      stopWebcam();
    };
  }, [enabled, startWebcam, stopWebcam]);

  useEffect(() => {
    if (!state.webcamEnabled) return;
    intervalRef.current = setInterval(detectFace, CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.webcamEnabled, detectFace]);

  return state;
}
