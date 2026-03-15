/**
 * Focus Engine — 6-signal weighted formula with EMA smoothing.
 *
 * FocusScore = (Gaze×0.22 + HeadPose×0.14 + TabVis×0.22 +
 *               ResponseLatency×0.12 + BlinkHealth×0.06 +
 *               Interaction×0.24) × PersonalBaselineMultiplier
 *
 * All signals are 0–100. No raw video/frames leave the device.
 */

import type { FocusSignals, FocusLevel } from "@/types";

/* ─── Weights ─── */
const W = {
  gaze: 0.22,
  headPose: 0.14,
  tabVisibility: 0.22,
  responseLatency: 0.12,
  blinkHealth: 0.06,
  interaction: 0.24,
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
 * Response latency score: forgiving for normal thinking time.
 * 100 within 8s, then decays gradually and floors instead of crashing to 0.
 */
export function computeResponseLatencyScore(
  lastQuestionAt: number | null,
  lastResponseAt: number | null,
  now: number
): number {
  if (lastQuestionAt === null) return 100; // No question asked yet

  if (lastResponseAt !== null && lastResponseAt > lastQuestionAt) {
    // Already responded — hold at the score they earned, decay slowly.
    const responseDelta = (lastResponseAt - lastQuestionAt) / 1000;
    const scoreAtResponse = Math.max(75, Math.round(100 - Math.max(0, responseDelta - 8) * 4));
    const sinceThen = (now - lastResponseAt) / 1000;
    return Math.max(scoreAtResponse - Math.floor(sinceThen / 15) * 1, 75);
  }

  // Waiting for response
  const elapsed = (now - lastQuestionAt) / 1000;
  if (elapsed <= 8) return 100;
  if (elapsed <= 20) return Math.max(70, Math.round(100 - (elapsed - 8) * 2.5));
  if (elapsed <= 30) return Math.max(55, Math.round(70 - (elapsed - 20) * 1.5));
  return 55;
}

/**
 * Interaction score: listening/working quietly should not tank the score.
 */
export function computeInteractionScore(lastInputAt: number, now: number): number {
  const elapsed = (now - lastInputAt) / 1000;
  if (elapsed <= 45) return 100;
  if (elapsed <= 90) return 85;
  if (elapsed <= 150) return 70;
  return 55;
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
