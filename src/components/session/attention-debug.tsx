"use client";

/**
 * AttentionDebug — overlay toggled by Ctrl+Shift+D.
 * Shows face mesh landmarks, all 6 raw signal scores, SmoothedFocus,
 * ContentConfidence, and last 10 policy decisions.
 */

import { useEffect, useRef, useState } from "react";
import type { FocusSignals, PolicyDecision, ContentConfidenceState } from "@/types";
import type { CalibrationState } from "@/lib/focus-engine";

interface AttentionDebugProps {
  webcamStream: MediaStream | null;
  landmarks: React.RefObject<Array<{ x: number; y: number; z: number }> | null>;
  signals: FocusSignals;
  smoothedFocus: number;
  contentConfidence: ContentConfidenceState | null;
  calibration: CalibrationState;
  policyLog: PolicyDecision[];
}

export function AttentionDebug({
  webcamStream,
  landmarks,
  signals,
  smoothedFocus,
  contentConfidence,
  calibration,
  policyLog,
}: AttentionDebugProps) {
  const [visible, setVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  // Toggle with Ctrl+Shift+D
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setVisible((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Attach webcam stream to video element
  useEffect(() => {
    if (!visible || !webcamStream || !videoRef.current) return;
    videoRef.current.srcObject = webcamStream;
    videoRef.current.play().catch(() => {});
  }, [visible, webcamStream]);

  // Draw landmarks on canvas
  useEffect(() => {
    if (!visible) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    function draw() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const lm = landmarks.current;
      if (lm && lm.length > 0) {
        ctx.fillStyle = "rgba(200, 65, 106, 0.6)";
        for (const point of lm) {
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [visible, landmarks]);

  if (!visible) return null;

  const cc = contentConfidence?.overall ?? 0;

  const signalRows: [string, number, string][] = [
    ["Gaze", signals.gazeScore, "#8b5cf6"],
    ["Head Pose", signals.headPoseScore, "#3b82f6"],
    ["Tab Visible", signals.tabVisibilityScore, "#10b981"],
    ["Response", signals.responseLatencyScore, "#f59e0b"],
    ["Blink", signals.blinkHealthScore, "#ec4899"],
    ["Interaction", signals.interactionScore, "#06b6d4"],
  ];

  return (
    <div style={{
      position: "fixed",
      top: 8,
      right: 8,
      zIndex: 9999,
      width: 340,
      maxHeight: "calc(100vh - 16px)",
      overflowY: "auto",
      background: "rgba(10, 10, 14, 0.92)",
      backdropFilter: "blur(12px)",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.1)",
      color: "#e5e5e5",
      fontFamily: "'SF Mono', 'Fira Code', monospace",
      fontSize: 11,
      padding: 14,
      boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ color: "#c8416a", fontWeight: 700, fontSize: 12 }}>🔬 Attention Debug</span>
        <span style={{ fontSize: 10, opacity: 0.4 }}>Ctrl+Shift+D</span>
      </div>

      {/* Webcam + Landmarks */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", borderRadius: 8, overflow: "hidden", marginBottom: 10, background: "#111" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "scaleX(-1)" }}
        />
        {!calibration.completed && (
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "6px 8px",
            background: "rgba(245,158,11,0.85)",
            color: "#000",
            fontSize: 10,
            fontWeight: 700,
            textAlign: "center",
          }}>
            CALIBRATING... {Math.round(((Date.now() - calibration.startedAt) / 120000) * 100)}%
          </div>
        )}
      </div>

      {/* Big scores */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <ScoreCard label="Focus" value={smoothedFocus} color={smoothedFocus >= 80 ? "#10b981" : smoothedFocus >= 50 ? "#f59e0b" : "#ef4444"} />
        <ScoreCard label="Confidence" value={cc} color={cc >= 60 ? "#8b5cf6" : cc >= 40 ? "#f59e0b" : "#ef4444"} />
        <ScoreCard label="Multiplier" value={Number(calibration.multiplier.toFixed(2))} color="#6b7280" small />
      </div>

      {/* Signal bars */}
      <div style={{ marginBottom: 10 }}>
        {signalRows.map(([label, value, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ width: 70, fontSize: 10, opacity: 0.7 }}>{label}</span>
            <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s ease" }} />
            </div>
            <span style={{ width: 28, textAlign: "right", fontSize: 10, fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Policy log */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, marginBottom: 4 }}>POLICY LOG</div>
        {policyLog.length === 0 ? (
          <div style={{ fontSize: 10, opacity: 0.3 }}>No decisions yet</div>
        ) : (
          policyLog.slice().reverse().map((d, i) => (
            <div key={i} style={{
              display: "flex",
              gap: 6,
              padding: "3px 0",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              fontSize: 10,
            }}>
              <span style={{ opacity: 0.4, width: 50 }}>
                {new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span style={{
                padding: "1px 5px",
                borderRadius: 3,
                fontWeight: 600,
                fontSize: 9,
                background: d.mode === "normal" ? "rgba(16,185,129,0.2)" :
                  d.mode === "gentle_checkin" ? "rgba(245,158,11,0.2)" :
                  d.mode === "micro_task" ? "rgba(239,68,68,0.2)" :
                  d.mode === "simplify" ? "rgba(139,92,246,0.2)" :
                  "rgba(239,68,68,0.4)",
                color: d.mode === "normal" ? "#10b981" :
                  d.mode === "gentle_checkin" ? "#f59e0b" :
                  d.mode === "micro_task" ? "#ef4444" :
                  d.mode === "simplify" ? "#8b5cf6" :
                  "#ef4444",
              }}>
                {d.mode}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ScoreCard({ label, value, color, small }: { label: string; value: number; color: string; small?: boolean }) {
  return (
    <div style={{
      flex: 1,
      textAlign: "center",
      padding: small ? "6px 4px" : "8px 4px",
      borderRadius: 8,
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${color}33`,
    }}>
      <div style={{ fontSize: small ? 16 : 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}
