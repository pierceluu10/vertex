export interface Parent {
  id: string;
  email: string;
  name: string;
  child_name: string | null;
  grade_level: string | null;
  math_topics: string[];
  learning_pace: "slow" | "medium" | "fast";
  notification_realtime: boolean;
  notification_daily: boolean;
  notification_daily_time: string;
  avatar_url: string | null;
  heygen_avatar_id: string | null;
  heygen_talking_photo_id: string | null;
  created_at: string;
}

export interface AccessCode {
  id: string;
  parent_id: string;
  code: string;
  child_name: string | null;
  child_age?: number | null;
  grade_level?: string | null;
  math_topics?: string[] | null;
  learning_goals?: string | null;
  learning_pace?: "slow" | "medium" | "fast" | null;
  is_active: boolean;
  created_at: string;
}

export interface KidSession {
  id: string;
  parent_id: string;
  code_used: string;
  child_name: string | null;
  avatar_choice: string | null;
  streak_count: number;
  xp_points: number;
  last_active_date: string | null;
  created_at: string;
}

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  age: number;
  grade: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface LearningProfile {
  id: string;
  child_id: string;
  preferred_pace: "slow" | "normal" | "fast";
  difficulty_level: "below-grade" | "grade-level" | "above-grade";
  topics_struggled: string[];
  topics_mastered: string[];
  recent_mistakes: MistakeRecord[];
  updated_at: string;
}

export interface MistakeRecord {
  topic: string;
  question: string;
  child_answer: string;
  correct_answer: string;
  timestamp: string;
}

export interface UploadedDocument {
  id: string;
  parent_id: string;
  child_id: string | null;
  kid_session_id: string | null;
  file_name: string;
  file_url: string;
  extracted_text: string | null;
  chunks: DocumentChunk[] | null;
  uploaded_at: string;
}

export interface DocumentChunk {
  index: number;
  text: string;
  page?: number;
}

export interface Session {
  id: string;
  parent_id: string;
  kid_session_id: string | null;
  focus_score: number;
  study_duration: number;
  distraction_events: DistractionEvent[];
  created_at: string;
  ended_at: string | null;
}

export interface DistractionEvent {
  type: string;
  timestamp: string;
  duration_ms?: number;
}

export interface TutoringSession {
  id: string;
  child_id: string | null;
  kid_session_id: string | null;
  document_id: string | null;
  status: "active" | "paused" | "completed";
  session_summary: string | null;
  focus_score_avg: number | null;
  started_at: string;
  ended_at: string | null;
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  message_type: "chat" | "quiz" | "hint" | "reminder";
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Quiz {
  id: string;
  parent_id: string | null;
  kid_session_id: string | null;
  questions: QuizQuestion[];
  answers: QuizAnswer[] | null;
  score: number | null;
  taken_at: string;
}

export interface QuizQuestion {
  index: number;
  question: string;
  type: "multiple_choice" | "open";
  options?: string[];
  correct_answer: string;
}

export interface QuizAnswer {
  index: number;
  answer: string;
  is_correct: boolean;
}

export interface QuizAttempt {
  id: string;
  session_id: string | null;
  child_id: string | null;
  kid_session_id: string | null;
  question: string;
  child_answer: string | null;
  correct_answer: string;
  is_correct: boolean | null;
  topic: string | null;
  created_at: string;
}

export interface Homework {
  id: string;
  parent_id: string;
  kid_session_id: string | null;
  file_url: string;
  parsed_text: string | null;
  uploaded_at: string;
}

export interface FocusEvent {
  id: string;
  session_id: string;
  event_type: "tab_blur" | "inactive" | "face_absent" | "no_response";
  duration_ms: number | null;
  intervention: string | null;
  created_at: string;
}

export interface ParentReport {
  id: string;
  session_id: string;
  parent_id: string;
  summary: string;
  topics_covered: string[] | null;
  struggles: string[] | null;
  focus_summary: FocusSummary | null;
  quiz_results: QuizSummary | null;
  suggestions: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface FocusSummary {
  total_focus_events: number;
  total_distraction_time_ms: number;
  tab_blur_count: number;
  inactivity_count: number;
  interventions_triggered: number;
}

export interface QuizSummary {
  total_questions: number;
  correct: number;
  incorrect: number;
  topics: string[];
}

export type FocusLevel = "high" | "medium" | "low" | "critical";

export interface AttentionState {
  focusLevel: FocusLevel;
  score: number;
  lastActivityTimestamp: number;
  tabVisible: boolean;
  consecutiveDistractionsCount: number;
}

export interface AdaptiveState {
  currentDifficulty: "easy" | "medium" | "hard";
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  shouldSimplify: boolean;
  currentTone: "encouraging" | "neutral" | "supportive";
}
