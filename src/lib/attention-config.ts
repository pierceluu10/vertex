export const ATTENTION_CONFIG = {
  // Penalties — reduced to be more realistic for kids
  TAB_BLUR_PENALTY: 10,
  TAB_FOCUS_RECOVERY: 8,
  ACTIVITY_RECOVERY: 3,
  INACTIVITY_THRESHOLD_MS: 45_000, // 45s before counting as inactive (kids think!)
  INACTIVITY_PENALTY_PER_TICK: 3,
  INACTIVITY_MAX_PENALTY: 12,

  // Webcam — gentler penalties, bigger recovery
  NO_FACE_PENALTY: 5,
  LOOKING_AWAY_PENALTY: 4,
  HEAD_TURNED_PENALTY: 3,
  FACE_RETURN_RECOVERY: 6,

  PROMPT_UNANSWERED_PENALTY: 6,
  REPEATED_CONFUSION_PENALTY: 5,

  // Thresholds
  HIGH_THRESHOLD: 70,
  MEDIUM_THRESHOLD: 45,
  LOW_THRESHOLD: 20,

  HIGH_DISTRACTION_COUNT: 5, // More tolerance before highest intervention

  // Intervals
  WEBCAM_CHECK_INTERVAL_MS: 2_000,
  INACTIVITY_CHECK_INTERVAL_MS: 15_000, // Check less frequently
  INTERVENTION_CHECK_INTERVAL_MS: 30_000, // 30s between checks
  INTERVENTION_COOLDOWN_MS: 180_000, // 3 min cooldown (avoid nagging)

  // Grace periods
  FACE_ABSENT_GRACE_MS: 5_000, // 5s — kids look at paper, keyboard, etc
  LOOKING_AWAY_GRACE_MS: 6_000, // 6s — natural to glance away briefly
} as const;

export type AttentionEvent =
  | "PAGE_HIDDEN"
  | "PAGE_VISIBLE"
  | "WINDOW_BLUR"
  | "WINDOW_FOCUS"
  | "USER_IDLE"
  | "USER_ACTIVE"
  | "PROMPT_UNANSWERED"
  | "REPEATED_CONFUSION"
  | "FACE_PRESENT"
  | "NO_FACE"
  | "LOOKING_AWAY"
  | "HEAD_TURNED"
  | "POSSIBLE_CONFUSION";
