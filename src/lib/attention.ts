import type { AttentionState, FocusLevel } from "@/types";
import { ATTENTION_CONFIG } from "./attention-config";

export function createInitialAttentionState(): AttentionState {
  return {
    focusLevel: "high",
    score: 100,
    lastActivityTimestamp: Date.now(),
    tabVisible: true,
    consecutiveDistractionsCount: 0,
  };
}

export function computeFocusLevel(score: number): FocusLevel {
  if (score >= ATTENTION_CONFIG.HIGH_THRESHOLD) return "high";
  if (score >= ATTENTION_CONFIG.MEDIUM_THRESHOLD) return "medium";
  if (score >= ATTENTION_CONFIG.LOW_THRESHOLD) return "low";
  return "critical";
}

function applyScore(state: AttentionState, delta: number, incrementDistractions = false): AttentionState {
  const newScore = Math.max(0, Math.min(100, state.score + delta));
  const newCount = incrementDistractions
    ? state.consecutiveDistractionsCount + 1
    : delta > 0 ? 0 : state.consecutiveDistractionsCount;
  return {
    ...state,
    score: newScore,
    consecutiveDistractionsCount: newCount,
    focusLevel: computeFocusLevel(newScore),
  };
}

export function handleTabBlur(state: AttentionState): AttentionState {
  return applyScore({ ...state, tabVisible: false }, -ATTENTION_CONFIG.TAB_BLUR_PENALTY, true);
}

export function handleTabFocus(state: AttentionState): AttentionState {
  return applyScore(
    { ...state, tabVisible: true, lastActivityTimestamp: Date.now() },
    ATTENTION_CONFIG.TAB_FOCUS_RECOVERY
  );
}

export function handleActivity(state: AttentionState): AttentionState {
  return applyScore(
    { ...state, lastActivityTimestamp: Date.now() },
    ATTENTION_CONFIG.ACTIVITY_RECOVERY
  );
}

export function handleInactivityCheck(state: AttentionState): AttentionState {
  const elapsed = Date.now() - state.lastActivityTimestamp;
  if (elapsed < ATTENTION_CONFIG.INACTIVITY_THRESHOLD_MS) return state;

  const penalty = Math.min(
    ATTENTION_CONFIG.INACTIVITY_MAX_PENALTY,
    Math.floor(elapsed / ATTENTION_CONFIG.INACTIVITY_THRESHOLD_MS) * ATTENTION_CONFIG.INACTIVITY_PENALTY_PER_TICK
  );
  return applyScore(state, -penalty, true);
}

export function handleNoFace(state: AttentionState): AttentionState {
  return applyScore(state, -ATTENTION_CONFIG.NO_FACE_PENALTY, true);
}

export function handleLookingAway(state: AttentionState): AttentionState {
  return applyScore(state, -ATTENTION_CONFIG.LOOKING_AWAY_PENALTY, true);
}

export function handleHeadTurned(state: AttentionState): AttentionState {
  return applyScore(state, -ATTENTION_CONFIG.HEAD_TURNED_PENALTY, true);
}

export function handleFaceReturn(state: AttentionState): AttentionState {
  return applyScore(state, ATTENTION_CONFIG.FACE_RETURN_RECOVERY);
}

export function handlePromptUnanswered(state: AttentionState): AttentionState {
  return applyScore(state, -ATTENTION_CONFIG.PROMPT_UNANSWERED_PENALTY, true);
}

export function handleRepeatedConfusion(state: AttentionState): AttentionState {
  return applyScore(state, -ATTENTION_CONFIG.REPEATED_CONFUSION_PENALTY, true);
}

export function getIntervention(state: AttentionState): string | null {
  if (state.focusLevel === "high") return null;

  if (state.focusLevel === "medium") {
    return "gentle_reminder";
  }

  if (state.focusLevel === "low") {
    return "engage_quiz";
  }

  if (
    state.focusLevel === "critical" ||
    state.consecutiveDistractionsCount >= ATTENTION_CONFIG.HIGH_DISTRACTION_COUNT
  ) {
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
      return `Hey ${childName}! Let\u2019s keep going \u2014 you were doing great!`;
    case "engage_quiz":
      return `How about a quick fun question, ${childName}? Let\u2019s see what you remember!`;
    case "simplify_and_checkin":
      return `${childName}, are you still there? No worries \u2014 let\u2019s try something a little easier together!`;
    default:
      return `Come on, ${childName}! Let\u2019s get back to it!`;
  }
}
