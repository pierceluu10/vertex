"use client";

/**
 * useAttention — orchestrates the 6-signal focus engine.
 *
 * Reads face mesh signals from useWebcamAttention, tracks tab visibility,
 * input recency, and response latency. Computes SmoothedFocus via EMA every 5s.
 * Saves focus_timeline to Supabase every 30s.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useWebcamAttention, type FaceMeshSignals } from "./use-webcam-attention";
import {
  computeRawFocusScore,
  applyEMA,
  focusLevelFromScore,
  computeTabVisibilityScore,
  computeResponseLatencyScore,
  computeInteractionScore,
  createCalibrationState,
  addCalibrationSample,
  type CalibrationState,
} from "@/lib/focus-engine";
import type { AttentionState, FocusSignals, FocusTimelineEntry } from "@/types";

const SCORE_TICK_MS = 5_000; // Compute score every 5s
const SAVE_INTERVAL_MS = 30_000; // Save timeline to Supabase every 30s

export function useAttention(
  sessionId: string,
  onIntervention: (type: string) => void,
  webcamEnabled = true
) {
  const [attention, setAttention] = useState<AttentionState>({
    focusLevel: "high",
    score: 100,
    lastActivityTimestamp: Date.now(),
    tabVisible: true,
    consecutiveDistractionsCount: 0,
  });

  const [signals, setSignals] = useState<FocusSignals>({
    gazeScore: 100,
    headPoseScore: 100,
    tabVisibilityScore: 100,
    responseLatencyScore: 100,
    blinkHealthScore: 100,
    interactionScore: 100,
  });

  const [calibration, setCalibration] = useState<CalibrationState>(createCalibrationState);

  const stateRef = useRef(attention);
  const signalsRef = useRef(signals);
  const calibrationRef = useRef(calibration);
  const timelineRef = useRef<FocusTimelineEntry[]>([]);
  const smoothedRef = useRef(100);

  // Tab visibility tracking
  const hiddenSinceRef = useRef<number | null>(null);

  // Response latency tracking (set externally via returned methods)
  const lastQuestionAtRef = useRef<number | null>(null);
  const lastResponseAtRef = useRef<number | null>(null);

  // Input tracking
  const lastInputRef = useRef(Date.now());

  // Latest face mesh signals — neutral (50) until real camera data arrives
  const meshSignalsRef = useRef<FaceMeshSignals>({ gazeScore: 50, headPoseScore: 50, blinkHealthScore: 50 });
  const hasCameraDataRef = useRef(false);

  useEffect(() => { stateRef.current = attention; }, [attention]);
  useEffect(() => { signalsRef.current = signals; }, [signals]);
  useEffect(() => { calibrationRef.current = calibration; }, [calibration]);

  /* ─── Face mesh signal callback ─── */
  const handleMeshSignals = useCallback((s: FaceMeshSignals) => {
    meshSignalsRef.current = s;
    hasCameraDataRef.current = true;

    // Feed calibration
    setCalibration((prev) => {
      if (prev.completed) return prev;
      return addCalibrationSample(prev, s.gazeScore, s.headPoseScore, s.blinkHealthScore);
    });
  }, []);

  /* ─── Face events (for backward compat) ─── */
  const handleFaceEvent = useCallback(() => {
    // Face events are now handled internally by the signals. No-op for legacy.
  }, []);

  const webcam = useWebcamAttention(webcamEnabled, handleFaceEvent, handleMeshSignals);

  // Reset camera data flag when webcam is toggled off
  useEffect(() => {
    if (!webcamEnabled) {
      hasCameraDataRef.current = false;
      meshSignalsRef.current = { gazeScore: 50, headPoseScore: 50, blinkHealthScore: 50 };
    }
  }, [webcamEnabled]);

  /* ─── Tab visibility ─── */
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) {
        hiddenSinceRef.current = Date.now();
      } else {
        hiddenSinceRef.current = null;
      }
    }

    function onUserInput() {
      lastInputRef.current = Date.now();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("mousemove", onUserInput);
    document.addEventListener("keydown", onUserInput);
    document.addEventListener("click", onUserInput);
    document.addEventListener("touchstart", onUserInput);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("mousemove", onUserInput);
      document.removeEventListener("keydown", onUserInput);
      document.removeEventListener("click", onUserInput);
      document.removeEventListener("touchstart", onUserInput);
    };
  }, []);

  /* ─── Main score computation tick (every 5s) ─── */
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const hasCam = hasCameraDataRef.current;
      const mesh = hasCam ? meshSignalsRef.current : { gazeScore: 50, headPoseScore: 50, blinkHealthScore: 50 };
      const cal = calibrationRef.current;

      const currentSignals: FocusSignals = {
        gazeScore: mesh.gazeScore,
        headPoseScore: mesh.headPoseScore,
        blinkHealthScore: mesh.blinkHealthScore,
        tabVisibilityScore: computeTabVisibilityScore(!document.hidden, hiddenSinceRef.current, now),
        responseLatencyScore: computeResponseLatencyScore(
          lastQuestionAtRef.current,
          lastResponseAtRef.current,
          now
        ),
        interactionScore: computeInteractionScore(lastInputRef.current, now),
      };

      setSignals(currentSignals);

      const rawScore = computeRawFocusScore(currentSignals, cal.completed ? cal.multiplier : 1.0);
      const smoothed = applyEMA(smoothedRef.current, rawScore);
      smoothedRef.current = smoothed;

      const focusLevel = focusLevelFromScore(smoothed);

      // Track consecutive low focus
      const consecutiveLow = smoothed < 50
        ? stateRef.current.consecutiveDistractionsCount + 1
        : 0;

      setAttention({
        score: smoothed,
        focusLevel,
        tabVisible: !document.hidden,
        lastActivityTimestamp: lastInputRef.current,
        consecutiveDistractionsCount: consecutiveLow,
      });

      // Add to timeline
      timelineRef.current.push({ timestamp: now, score: smoothed });
    }, SCORE_TICK_MS);

    return () => clearInterval(interval);
  }, []);

  /* ─── Save timeline to Supabase every 30s ─── */
  useEffect(() => {
    if (!sessionId || sessionId === "none") return;

    const interval = setInterval(async () => {
      const entries = timelineRef.current;
      if (entries.length === 0) return;

      try {
        await fetch("/api/focus/timeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, entries }),
        });
      } catch {
        // Non-critical
      }
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [sessionId]);

  /* ─── Public API ─── */
  const markQuestionAsked = useCallback(() => {
    lastQuestionAtRef.current = Date.now();
    lastResponseAtRef.current = null;
  }, []);

  const markResponseReceived = useCallback(() => {
    lastResponseAtRef.current = Date.now();
  }, []);

  function getSessionAverageScore(): number {
    const entries = timelineRef.current;
    if (entries.length === 0) return stateRef.current.score;
    const sum = entries.reduce((a, e) => a + e.score, 0);
    return Math.round(sum / entries.length);
  }

  return {
    ...attention,
    signals,
    calibration,
    webcam,
    getSessionAverageScore,
    markQuestionAsked,
    markResponseReceived,
    timeline: timelineRef,
  };
}
