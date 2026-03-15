/**
 * Content Confidence Engine
 *
 * ContentConfidence = (QuizAccuracy×0.35 + ResponseQuality×0.25 +
 *                      HintDependency×0.20 + RepeatQuestion×0.10 +
 *                      ResponseSpeed×0.10) × MasteryDecayFactor
 */

/* ─── Weights ─── */
const W = {
  quizAccuracy: 0.35,
  responseQuality: 0.25,
  hintDependency: 0.20,
  repeatQuestion: 0.10,
  responseSpeed: 0.10,
} as const;

/* ─── Quiz Accuracy ─── */

export interface QuizResult {
  correct: number;
  total: number;
  timestamp: number;
}

/**
 * Rolling window of last 3 quizzes, most recent double-weighted.
 */
export function computeQuizAccuracy(quizzes: QuizResult[]): number {
  if (quizzes.length === 0) return 100; // No quizzes yet → assume perfect

  const recent = quizzes.slice(-3);
  let totalWeight = 0;
  let weightedSum = 0;

  recent.forEach((q, i) => {
    const isLast = i === recent.length - 1;
    const weight = isLast ? 2 : 1;
    const accuracy = q.total > 0 ? (q.correct / q.total) * 100 : 0;
    weightedSum += accuracy * weight;
    totalWeight += weight;
  });

  return Math.round(weightedSum / totalWeight);
}

/* ─── Hint Dependency ─── */

/**
 * Per-question hint counts averaged across session.
 * 0 hints=100, 1=70, 2=40, 3+=10.
 */
export function computeHintDependency(hintCountsPerQuestion: number[]): number {
  if (hintCountsPerQuestion.length === 0) return 100;

  const scores = hintCountsPerQuestion.map((h) => {
    if (h === 0) return 100;
    if (h === 1) return 70;
    if (h === 2) return 40;
    return 10;
  });

  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/* ─── Response Speed ─── */

/**
 * Normalizes response time against personal average from first 3 questions.
 * At or faster = 100, 2× slower = 40, 3×+ = 10.
 */
export function computeResponseSpeed(
  responseTimes: number[],
  currentResponseTime: number
): number {
  if (responseTimes.length < 3) return 100; // Not enough data yet

  const baseline = responseTimes.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  if (baseline <= 0) return 100;

  const ratio = currentResponseTime / baseline;
  if (ratio <= 1) return 100;
  if (ratio >= 3) return 10;

  // Linear interpolation: ratio 1→100, ratio 2→40, ratio 3→10
  if (ratio <= 2) return Math.round(100 - (ratio - 1) * 60);
  return Math.round(40 - (ratio - 2) * 30);
}

/* ─── Repeat Question Detection (cosine similarity) ─── */

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Each repeat on the same topic subtracts 20 from 100, floored at 0.
 */
export function computeRepeatQuestionScore(repeatCount: number): number {
  return Math.max(0, 100 - repeatCount * 20);
}

/* ─── Mastery Decay Factor ─── */

/**
 * 2% per day of inactivity, floored at 30%.
 */
export function computeMasteryDecayFactor(
  lastActiveAt: Date | null,
  now: Date
): number {
  if (!lastActiveAt) return 1.0;
  const daysSinceActive = (now.getTime() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceActive <= 0) return 1.0;
  const decay = 1.0 - daysSinceActive * 0.02;
  return Math.max(0.30, decay);
}

/* ─── Main computation ─── */

export function computeContentConfidence(
  quizAccuracy: number,
  responseQuality: number,
  hintDependency: number,
  repeatQuestionScore: number,
  responseSpeed: number,
  masteryDecayFactor: number
): number {
  const raw =
    quizAccuracy * W.quizAccuracy +
    responseQuality * W.responseQuality +
    hintDependency * W.hintDependency +
    repeatQuestionScore * W.repeatQuestion +
    responseSpeed * W.responseSpeed;

  return Math.max(0, Math.min(100, Math.round(raw * masteryDecayFactor)));
}
