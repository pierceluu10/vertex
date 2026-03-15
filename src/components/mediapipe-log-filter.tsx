"use client";

// MediaPipe's WASM runtime unconditionally uses console.error for all log
// levels (INFO, WARNING, ERROR). This runs once at app startup — before any
// MediaPipe code loads — and silently drops messages that are purely
// informational so they never appear in the Next.js dev error overlay.
if (typeof window !== "undefined") {
  const _orig = console.error.bind(console);
  const _origWarn = console.warn.bind(console);

  const isMediaPipeLog = (s: string) =>
    s.startsWith("INFO:") ||
    s.startsWith("WARNING:") ||
    s.startsWith("W0") ||
    s.startsWith("I0") ||
    s.includes("face_landmarker_graph") ||
    s.includes("inference_feedback_manager") ||
    s.includes("gl_context") ||
    s.includes("Graph successfully");

  console.error = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (isMediaPipeLog(first)) return;
    _orig(...args);
  };

  console.warn = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (isMediaPipeLog(first)) return;
    _origWarn(...args);
  };
}

export default function MediaPipeLogFilter() {
  return null;
}
