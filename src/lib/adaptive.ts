import type { AdaptiveState } from "@/types";

export function createInitialAdaptiveState(): AdaptiveState {
  return {
    currentDifficulty: "medium",
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    shouldSimplify: false,
    currentTone: "encouraging",
  };
}

export function handleCorrectAnswer(state: AdaptiveState): AdaptiveState {
  const newCorrect = state.consecutiveCorrect + 1;
  const shouldIncrease = newCorrect >= 3;

  return {
    ...state,
    consecutiveCorrect: newCorrect,
    consecutiveIncorrect: 0,
    currentDifficulty: shouldIncrease
      ? state.currentDifficulty === "easy"
        ? "medium"
        : "hard"
      : state.currentDifficulty,
    shouldSimplify: false,
    currentTone: "encouraging",
  };
}

export function handleIncorrectAnswer(state: AdaptiveState): AdaptiveState {
  const newIncorrect = state.consecutiveIncorrect + 1;
  const shouldDecrease = newIncorrect >= 2;

  return {
    ...state,
    consecutiveCorrect: 0,
    consecutiveIncorrect: newIncorrect,
    currentDifficulty: shouldDecrease
      ? state.currentDifficulty === "hard"
        ? "medium"
        : "easy"
      : state.currentDifficulty,
    shouldSimplify: newIncorrect >= 2,
    currentTone: newIncorrect >= 2 ? "supportive" : "encouraging",
  };
}

export function handleDistraction(state: AdaptiveState): AdaptiveState {
  return {
    ...state,
    shouldSimplify: true,
    currentTone: "supportive",
    currentDifficulty:
      state.currentDifficulty === "hard" ? "medium" : state.currentDifficulty,
  };
}
