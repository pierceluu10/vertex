import type { AttentionState, FocusLevel } from "@/types";

const INACTIVITY_THRESHOLD_MS = 30_000;
const HIGH_DISTRACTION_THRESHOLD = 3;

export function createInitialAttentionState(): AttentionState {
  return {
    focusLevel: "high",
    score: 100,
    lastActivityTimestamp: Date.now(),
    tabVisible: true,
    consecutiveDistractionsCount: 0,
  };
}

export function computeFocusLevel(state: AttentionState): FocusLevel {
  if (state.score >= 75) return "high";
  if (state.score >= 50) return "medium";
  if (state.score >= 25) return "low";
  return "critical";
}

export function handleTabBlur(state: AttentionState): AttentionState {
  const newScore = Math.max(0, state.score - 15);
  const newCount = state.consecutiveDistractionsCount + 1;
  return {
    ...state,
    tabVisible: false,
    score: newScore,
    consecutiveDistractionsCount: newCount,
    focusLevel: computeFocusLevel({ ...state, score: newScore }),
  };
}

export function handleTabFocus(state: AttentionState): AttentionState {
  const newScore = Math.min(100, state.score + 5);
  return {
    ...state,
    tabVisible: true,
    score: newScore,
    lastActivityTimestamp: Date.now(),
    focusLevel: computeFocusLevel({ ...state, score: newScore }),
  };
}

export function handleActivity(state: AttentionState): AttentionState {
  const newScore = Math.min(100, state.score + 2);
  return {
    ...state,
    lastActivityTimestamp: Date.now(),
    score: newScore,
    consecutiveDistractionsCount: 0,
    focusLevel: computeFocusLevel({ ...state, score: newScore }),
  };
}

export function handleInactivityCheck(state: AttentionState): AttentionState {
  const elapsed = Date.now() - state.lastActivityTimestamp;
  if (elapsed < INACTIVITY_THRESHOLD_MS) return state;

  const penalty = Math.min(20, Math.floor(elapsed / INACTIVITY_THRESHOLD_MS) * 5);
  const newScore = Math.max(0, state.score - penalty);
  const newCount = state.consecutiveDistractionsCount + 1;

  return {
    ...state,
    score: newScore,
    consecutiveDistractionsCount: newCount,
    focusLevel: computeFocusLevel({ ...state, score: newScore }),
  };
}

export function getIntervention(state: AttentionState): string | null {
  if (state.focusLevel === "high") return null;

  if (state.focusLevel === "medium") {
    return "gentle_reminder";
  }

  if (state.focusLevel === "low") {
    return "engage_quiz";
  }

  if (state.focusLevel === "critical" || state.consecutiveDistractionsCount >= HIGH_DISTRACTION_THRESHOLD) {
    return "simplify_and_checkin";
  }

  return null;
}

export function getInterventionMessage(
  intervention: string,
  childName: string
): string {
  switch (intervention) {
    case "gentle_reminder":
      return `Hey ${childName}! Let's keep going — you were doing great! 😊`;
    case "engage_quiz":
      return `How about a quick fun question, ${childName}? Let's see what you remember!`;
    case "simplify_and_checkin":
      return `${childName}, are you still there? No worries — let's try something a little easier together!`;
    default:
      return `Come on, ${childName}! Let's get back to it!`;
  }
}
