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

  // Grace period tracking — don't penalize brief glances away
  const noFaceSinceRef = useRef<number | null>(null);
  const lookingAwaySinceRef = useRef<number | null>(null);
  const lastFaceEventRef = useRef<string>("FACE_PRESENT");

  // More realistic thresholds
  const FACE_ABSENT_GRACE_MS = 5000; // 5s before flagging no face (kids look at paper, etc)
  const LOOKING_AWAY_GRACE_MS = 6000; // 6s before flagging looking away
  const CHECK_INTERVAL_MS = 2000; // Check every 2s (less aggressive)

  // Rolling window to smooth out false positives
  const recentDetectionsRef = useRef<boolean[]>([]);
  const ROLLING_WINDOW = 5; // Consider last 5 detections

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
            minDetectionConfidence: 0.6,
          }
        );
        detectorRef.current = vision;
      }

      const detector = detectorRef.current as {
        detect: (image: HTMLCanvasElement) => {
          detections: Array<{
            boundingBox: { originX: number; originY: number; width: number; height: number };
            categories?: Array<{ score: number }>;
          }>
        }
      };
      const result = detector.detect(canvas);
      const faces = result.detections || [];
      const now = Date.now();

      // Track rolling window of face detections for smoothing
      const faceDetected = faces.length > 0;
      recentDetectionsRef.current.push(faceDetected);
      if (recentDetectionsRef.current.length > ROLLING_WINDOW) {
        recentDetectionsRef.current.shift();
      }

      // Only flag "no face" if majority of recent detections show no face
      const recentFaceCount = recentDetectionsRef.current.filter(Boolean).length;
      const consistentlyNoFace = recentFaceCount <= 1 && recentDetectionsRef.current.length >= 3;

      if (!faceDetected) {
        if (!noFaceSinceRef.current) {
          noFaceSinceRef.current = now;
        } else if (consistentlyNoFace && now - noFaceSinceRef.current > FACE_ABSENT_GRACE_MS) {
          if (lastFaceEventRef.current !== "NO_FACE") {
            setState((prev) => ({ ...prev, facePresent: false }));
            onFaceEvent("NO_FACE");
            lastFaceEventRef.current = "NO_FACE";
          }
        }
        lookingAwaySinceRef.current = null;
      } else {
        noFaceSinceRef.current = null;
        const face = faces[0];
        const box = face.boundingBox;
        const centerX = box.originX + box.width / 2;
        const centerY = box.originY + box.height / 2;
        const frameCenter = 160;
        const frameCenterY = 120;

        // More forgiving thresholds — kids move around
        const isHorizontallyOff = Math.abs(centerX - frameCenter) > 100;
        const isVerticallyOff = Math.abs(centerY - frameCenterY) > 90;
        const isOffCenter = isHorizontallyOff || isVerticallyOff;

        // Check if face is very small (far away / not at screen)
        const faceArea = box.width * box.height;
        const isTooFar = faceArea < 1500; // Very small face = far from screen

        if (isOffCenter || isTooFar) {
          if (!lookingAwaySinceRef.current) {
            lookingAwaySinceRef.current = now;
          } else if (now - lookingAwaySinceRef.current > LOOKING_AWAY_GRACE_MS) {
            if (lastFaceEventRef.current !== "LOOKING_AWAY") {
              setState((prev) => ({ ...prev, lookingAway: true, facePresent: true }));
              onFaceEvent("LOOKING_AWAY");
              lastFaceEventRef.current = "LOOKING_AWAY";
            }
          }
        } else {
          if (lastFaceEventRef.current !== "FACE_PRESENT") {
            onFaceEvent("FACE_PRESENT");
            lastFaceEventRef.current = "FACE_PRESENT";
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
  }, [onFaceEvent]);

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
