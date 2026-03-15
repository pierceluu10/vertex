"use client";

// MediaPipe's WASM runtime unconditionally uses console.error for all log
// levels (INFO, WARNING, ERROR). This runs once at app startup — before any
// MediaPipe code loads — and silently drops messages that are purely
// informational so they never appear in the Next.js dev error overlay.
if (typeof window !== "undefined") {
  const _orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (first.startsWith("INFO:") || first.startsWith("WARNING:")) return;
    _orig(...args);
  };
}

export default function MediaPipeLogFilter() {
  return null;
}
