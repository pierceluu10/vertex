/**
 * Focus Engine — 6-signal weighted formula with EMA smoothing.
 *
 * FocusScore = (Gaze×0.30 + HeadPose×0.20 + TabVis×0.15 +
 *               ResponseLatency×0.15 + BlinkHealth×0.10 +
 *               Interaction×0.10) × PersonalBaselineMultiplier
 *
 * All signals are 0–100. No raw video/frames leave the device.
 */

import type { FocusSignals, FocusLevel } from "@/types";

/* ─── Weights ─── */
const W = {
  gaze: 0.30,
  headPose: 0.20,
  tabVisibility: 0.15,
  responseLatency: 0.15,
  blinkHealth: 0.10,
  interaction: 0.10,
} as const;

/* ─── EMA parameters ─── */
const EMA_PREV = 0.7;
const EMA_RAW = 0.3;

/* ─── Signal helpers ─── */

/**
 * Tab visibility score: 100 when visible, decays 10/s when hidden.
 */
export function computeTabVisibilityScore(
  visible: boolean,
  hiddenSinceMs: number | null,
  now: number
): number {
  if (visible || hiddenSinceMs === null) return 100;
  const elapsedSec = (now - hiddenSinceMs) / 1000;
  return Math.max(0, Math.round(100 - elapsedSec * 10));
}

/**
 * Response latency score: 100 within 5s, −10/s after, 0 after 15s.
 * Holds last value with slow decay between questions.
 */
export function computeResponseLatencyScore(
  lastQuestionAt: number | null,
  lastResponseAt: number | null,
  now: number
): number {
  if (lastQuestionAt === null) return 100; // No question asked yet

  if (lastResponseAt !== null && lastResponseAt > lastQuestionAt) {
    // Already responded — hold at the score they earned, decay slowly
    const responseDelta = (lastResponseAt - lastQuestionAt) / 1000;
    const scoreAtResponse = Math.max(0, Math.round(100 - Math.max(0, responseDelta - 5) * 10));
    // Slow decay: 2 points per 10 seconds since response
    const sinceThen = (now - lastResponseAt) / 1000;
    return Math.max(scoreAtResponse - Math.floor(sinceThen / 10) * 2, 50);
  }

  // Waiting for response
  const elapsed = (now - lastQuestionAt) / 1000;
  if (elapsed <= 5) return 100;
  if (elapsed >= 15) return 0;
  return Math.max(0, Math.round(100 - (elapsed - 5) * 10));
}

/**
 * Interaction score: 100 if input in last 30s, 60 if 30–60s, 20 after 60s.
 */
export function computeInteractionScore(lastInputAt: number, now: number): number {
  const elapsed = (now - lastInputAt) / 1000;
  if (elapsed <= 30) return 100;
  if (elapsed <= 60) return 60;
  return 20;
}

/* ─── Main computation ─── */

export function computeRawFocusScore(
  signals: FocusSignals,
  baselineMultiplier: number
): number {
  const raw =
    signals.gazeScore * W.gaze +
    signals.headPoseScore * W.headPose +
    signals.tabVisibilityScore * W.tabVisibility +
    signals.responseLatencyScore * W.responseLatency +
    signals.blinkHealthScore * W.blinkHealth +
    signals.interactionScore * W.interaction;

  return Math.max(0, Math.min(100, Math.round(raw * baselineMultiplier)));
}

export function applyEMA(previous: number, raw: number): number {
  return Math.round(previous * EMA_PREV + raw * EMA_RAW);
}

export function focusLevelFromScore(score: number): FocusLevel {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  if (score >= 20) return "low";
  return "critical";
}

/* ─── Calibration ─── */

export interface CalibrationState {
  samples: { gaze: number; headPose: number; blink: number }[];
  startedAt: number;
  completed: boolean;
  multiplier: number;
}

const CALIBRATION_DURATION_MS = 2 * 60 * 1000; // 2 minutes

export function createCalibrationState(): CalibrationState {
  return {
    samples: [],
    startedAt: Date.now(),
    completed: false,
    multiplier: 1.0,
  };
}

export function addCalibrationSample(
  state: CalibrationState,
  gaze: number,
  headPose: number,
  blink: number
): CalibrationState {
  if (state.completed) return state;

  const now = Date.now();
  const newSamples = [...state.samples, { gaze, headPose, blink }];

  if (now - state.startedAt >= CALIBRATION_DURATION_MS && newSamples.length >= 10) {
    // Compute baseline averages
    const avgGaze = newSamples.reduce((s, x) => s + x.gaze, 0) / newSamples.length;
    const avgHeadPose = newSamples.reduce((s, x) => s + x.headPose, 0) / newSamples.length;
    const avgBlink = newSamples.reduce((s, x) => s + x.blink, 0) / newSamples.length;

    // Ideal baselines
    const gazeDeviation = (100 - avgGaze) / 100;
    const headDeviation = (100 - avgHeadPose) / 100;
    const blinkDeviation = Math.abs(100 - avgBlink) / 100;

    // Average deviation across signals
    const avgDeviation = (gazeDeviation + headDeviation + blinkDeviation) / 3;

    // Multiplier: if kid's natural baseline is below ideal, boost them; if above, slightly reduce
    // Clamped to [0.85, 1.15]
    const raw = 1.0 + (avgDeviation * 0.3);
    const multiplier = Math.max(0.85, Math.min(1.15, raw));

    return { ...state, samples: newSamples, completed: true, multiplier };
  }

  return { ...state, samples: newSamples };
}
