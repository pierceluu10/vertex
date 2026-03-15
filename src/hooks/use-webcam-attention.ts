"use client";

import { useEffect, useRef, useCallback, useState } from "react";

/* ─── Exported state shape ─── */
export interface WebcamAttentionState {
  facePresent: boolean;
  lookingAway: boolean;
  headTurned: boolean;
  webcamEnabled: boolean;
  permissionDenied: boolean;
  stream: MediaStream | null;
}

/* ─── Face mesh signal scores (0–100 each) ─── */
export interface FaceMeshSignals {
  gazeScore: number;
  headPoseScore: number;
  blinkHealthScore: number;
}

/* ─── EAR (Eye Aspect Ratio) landmarks ─── */
// https://google.github.io/mediapipe/solutions/face_mesh.html#face-landmark-model
// Left eye: 33, 160, 158, 133, 153, 144
// Right eye: 362, 385, 387, 263, 373, 380
// Iris center (left): 468, right: 473

const LEFT_EYE = [33, 160, 158, 133, 153, 144] as const;
const RIGHT_EYE = [362, 385, 387, 263, 373, 380] as const;
const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;

// Head pose landmarks
const NOSE_TIP = 1;
const CHIN = 152;
const LEFT_EAR = 234;
const RIGHT_EAR = 454;
const FOREHEAD = 10;

const CHECK_INTERVAL_MS = 100; // 10 fps
const SIGNAL_AGGREGATE_MS = 5000; // Aggregate every 5s

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function computeEAR(
  landmarks: Array<{ x: number; y: number; z: number }>,
  indices: readonly number[]
): number {
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.3;
  return (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4));
}

export function useWebcamAttention(
  enabled: boolean,
  onFaceEvent: (event: "FACE_PRESENT" | "NO_FACE" | "LOOKING_AWAY" | "HEAD_TURNED") => void,
  onSignals?: (signals: FaceMeshSignals) => void
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
  const landmarkerRef = useRef<unknown>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFaceEventRef = useRef<string>("FACE_PRESENT");

  // Blink tracking
  const blinksRef = useRef<number[]>([]); // timestamps of detected blinks
  const earBelowThresholdSinceRef = useRef<number | null>(null);
  const EAR_BLINK_THRESHOLD = 0.21;
  const EAR_FATIGUE_THRESHOLD = 0.2;
  const BLINK_COOLDOWN_MS = 250;
  const lastBlinkRef = useRef<number>(0);

  // Signal accumulation
  const signalSamplesRef = useRef<FaceMeshSignals[]>([]);
  const lastSignalEmitRef = useRef<number>(Date.now());

  // Grace periods
  const noFaceSinceRef = useRef<number | null>(null);
  const FACE_ABSENT_GRACE_MS = 5000;

  // For debug overlay
  const lastLandmarksRef = useRef<Array<{ x: number; y: number; z: number }> | null>(null);

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

  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 320, 240);

    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");

      if (!landmarkerRef.current) {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "IMAGE",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
        landmarkerRef.current = landmarker;
      }

      const landmarker = landmarkerRef.current as {
        detect?: (image: HTMLCanvasElement) => {
          faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
        };
      } | null;

      if (!landmarker?.detect) return;

      let result: { faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>> };
      try {
        result = landmarker.detect(canvas);
      } catch {
        return;
      }
      const faces = result?.faceLandmarks ?? [];
      const now = Date.now();

      if (faces.length === 0) {
        if (!noFaceSinceRef.current) {
          noFaceSinceRef.current = now;
        } else if (now - noFaceSinceRef.current > FACE_ABSENT_GRACE_MS) {
          if (lastFaceEventRef.current !== "NO_FACE") {
            setState((prev) => ({ ...prev, facePresent: false }));
            onFaceEvent("NO_FACE");
            lastFaceEventRef.current = "NO_FACE";
          }
        }

        // Push zero signals when no face
        signalSamplesRef.current.push({ gazeScore: 0, headPoseScore: 0, blinkHealthScore: 0 });
      } else {
        noFaceSinceRef.current = null;
        const lm = faces[0];
        lastLandmarksRef.current = lm;

        // ─── Gaze Score ───
        const gazeScore = computeGazeScore(lm);

        // ─── Head Pose Score ───
        const headPoseScore = computeHeadPoseScore(lm);

        // ─── Blink Health ───
        const leftEAR = computeEAR(lm, LEFT_EYE);
        const rightEAR = computeEAR(lm, RIGHT_EYE);
        const avgEAR = (leftEAR + rightEAR) / 2;

        // Detect blink
        if (avgEAR < EAR_BLINK_THRESHOLD && now - lastBlinkRef.current > BLINK_COOLDOWN_MS) {
          blinksRef.current.push(now);
          lastBlinkRef.current = now;
        }

        // Fatigue detection (EAR below threshold for >3s)
        if (avgEAR < EAR_FATIGUE_THRESHOLD) {
          if (!earBelowThresholdSinceRef.current) earBelowThresholdSinceRef.current = now;
        } else {
          earBelowThresholdSinceRef.current = null;
        }

        const blinkHealthScore = computeBlinkHealth(blinksRef.current, earBelowThresholdSinceRef.current, now);

        signalSamplesRef.current.push({ gazeScore, headPoseScore, blinkHealthScore });

        // Determine face event
        const isLookingAway = gazeScore < 40;
        const isHeadTurned = headPoseScore < 40;

        if (isHeadTurned) {
          if (lastFaceEventRef.current !== "HEAD_TURNED") {
            setState((prev) => ({ ...prev, facePresent: true, headTurned: true, lookingAway: false }));
            onFaceEvent("HEAD_TURNED");
            lastFaceEventRef.current = "HEAD_TURNED";
          }
        } else if (isLookingAway) {
          if (lastFaceEventRef.current !== "LOOKING_AWAY") {
            setState((prev) => ({ ...prev, facePresent: true, lookingAway: true, headTurned: false }));
            onFaceEvent("LOOKING_AWAY");
            lastFaceEventRef.current = "LOOKING_AWAY";
          }
        } else {
          if (lastFaceEventRef.current !== "FACE_PRESENT") {
            onFaceEvent("FACE_PRESENT");
            lastFaceEventRef.current = "FACE_PRESENT";
          }
          setState((prev) => ({ ...prev, facePresent: true, lookingAway: false, headTurned: false }));
        }
      }

      // Emit aggregated signals every 5s
      if (now - lastSignalEmitRef.current >= SIGNAL_AGGREGATE_MS && signalSamplesRef.current.length > 0) {
        const samples = signalSamplesRef.current;
        const avg: FaceMeshSignals = {
          gazeScore: Math.round(samples.reduce((s, x) => s + x.gazeScore, 0) / samples.length),
          headPoseScore: Math.round(samples.reduce((s, x) => s + x.headPoseScore, 0) / samples.length),
          blinkHealthScore: Math.round(samples.reduce((s, x) => s + x.blinkHealthScore, 0) / samples.length),
        };
        signalSamplesRef.current = [];
        lastSignalEmitRef.current = now;
        onSignals?.(avg);
      }
    } catch {
      // FaceLandmarker unavailable; degrade gracefully
    }
  }, [onFaceEvent, onSignals]);

  useEffect(() => {
    if (enabled) {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => { stopWebcam(); };
  }, [enabled, startWebcam, stopWebcam]);

  useEffect(() => {
    if (!state.webcamEnabled) return;
    intervalRef.current = setInterval(processFrame, CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.webcamEnabled, processFrame]);

  return { ...state, lastLandmarks: lastLandmarksRef };
}

/* ─── Gaze Score ─── */
function computeGazeScore(lm: Array<{ x: number; y: number; z: number }>): number {
  // Use iris center relative to eye corners
  const leftIris = lm[LEFT_IRIS];
  const rightIris = lm[RIGHT_IRIS];
  const leftInner = lm[LEFT_EYE[0]]; // inner corner
  const leftOuter = lm[LEFT_EYE[3]]; // outer corner
  const rightInner = lm[RIGHT_EYE[3]]; // inner corner
  const rightOuter = lm[RIGHT_EYE[0]]; // outer corner

  if (!leftIris || !rightIris || !leftInner || !leftOuter || !rightInner || !rightOuter) return 80;

  // Compute horizontal position of iris within eye (0 = inner, 1 = outer)
  const leftEyeWidth = dist(leftInner, leftOuter);
  const rightEyeWidth = dist(rightInner, rightOuter);
  if (leftEyeWidth === 0 || rightEyeWidth === 0) return 80;

  const leftIrisPos = dist(leftInner, leftIris) / leftEyeWidth;
  const rightIrisPos = dist(rightInner, rightIris) / rightEyeWidth;

  // Center is ~0.5; deviation from center reduces score
  const leftDeviation = Math.abs(leftIrisPos - 0.5) * 2; // 0–1
  const rightDeviation = Math.abs(rightIrisPos - 0.5) * 2; // 0–1
  const avgDeviation = (leftDeviation + rightDeviation) / 2;

  // Every degree of deviation reduces score; map 0–1 deviation to 0–90 degrees approximately
  const degreesOff = avgDeviation * 90;
  return Math.max(0, Math.round(100 - degreesOff * (100 / 90)));
}

/* ─── Head Pose Score ─── */
function computeHeadPoseScore(lm: Array<{ x: number; y: number; z: number }>): number {
  const nose = lm[NOSE_TIP];
  const chin = lm[CHIN];
  const leftEar = lm[LEFT_EAR];
  const rightEar = lm[RIGHT_EAR];
  const forehead = lm[FOREHEAD];

  if (!nose || !chin || !leftEar || !rightEar || !forehead) return 80;

  // Yaw: ratio of nose-to-left-ear vs nose-to-right-ear distance
  const noseToLeft = dist(nose, leftEar);
  const noseToRight = dist(nose, rightEar);
  const yawRatio = noseToLeft / (noseToRight + 0.001);
  // Centered ≈ 1.0; > 1.5 or < 0.67 means head is turned significantly
  const yawDeviation = Math.abs(1 - yawRatio);
  const yawDegrees = yawDeviation * 60; // rough mapping

  // Pitch: vertical distance forehead→nose vs nose→chin
  const foreheadToNose = dist(forehead, nose);
  const noseToChin = dist(nose, chin);
  const pitchRatio = foreheadToNose / (noseToChin + 0.001);
  const pitchDeviation = Math.abs(1 - pitchRatio);
  const pitchDegrees = pitchDeviation * 45; // rough mapping

  let score = 100;
  if (pitchDegrees > 20) score = Math.min(score, 20);
  else if (pitchDegrees > 10) score = Math.min(score, 60);

  if (yawDegrees > 30) score = Math.min(score, 30);
  else if (yawDegrees > 15) score = Math.min(score, 60);

  return score;
}

/* ─── Blink Health ─── */
function computeBlinkHealth(
  blinks: number[],
  earBelowSince: number | null,
  now: number
): number {
  // Fatigue: EAR below threshold for >3s
  if (earBelowSince && now - earBelowSince > 3000) return 20;

  // Rolling 60s blink rate
  const windowStart = now - 60000;
  const recentBlinks = blinks.filter((t) => t > windowStart);
  // Clean up old blinks
  while (blinks.length > 0 && blinks[0] < windowStart) blinks.shift();

  const rate = recentBlinks.length; // blinks per minute
  if (rate >= 15 && rate <= 20) return 100;
  if (rate >= 10 && rate <= 25) return 80;
  if (rate < 5) return 40;
  if (rate > 30) return 60;
  return 70;
}
