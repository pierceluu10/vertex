"use client";

/**
 * Dev-only Attention Engine Monitor
 * Route: /dev/attention-monitor
 * Runs the same attention pipeline in isolation and visualizes all calculations:
 * signals, weights, raw score, EMA, calibration, policy decisions, timeline.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeRawFocusScore,
  applyEMA,
  createCalibrationState,
  addCalibrationSample,
  type CalibrationState,
} from "@/lib/focus-engine";
import { useWebcamAttention, type FaceMeshSignals } from "@/hooks/use-webcam-attention";
import type { FocusSignals, PolicyDecision, PolicyMode } from "@/types";
import {
  computeTabVisibilityScore,
  computeResponseLatencyScore,
  computeInteractionScore,
} from "@/lib/focus-engine";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const SCORE_TICK_MS = 5_000;
const POLICY_TICK_MS = 30_000;
const W = {
  gaze: 0.30,
  headPose: 0.20,
  tabVisibility: 0.15,
  responseLatency: 0.15,
  blinkHealth: 0.10,
  interaction: 0.10,
} as const;
const EMA_PREV = 0.7;
const EMA_RAW = 0.3;

function computePolicyDecision(
  smoothedFocus: number,
  contentConfidenceOverall: number
): PolicyDecision {
  const now = Date.now();
  let mode: PolicyMode = "normal";
  let interventionText: string | null = null;
  let shouldEndSession = false;

  if (smoothedFocus >= 80) {
    mode = "normal";
  } else if (smoothedFocus >= 50) {
    mode = "gentle_checkin";
    interventionText = "Let's keep going — you were doing great!";
  } else {
    mode = "micro_task";
    interventionText = "Let's try one quick step at a time.";
  }

  if (contentConfidenceOverall < 40) {
    if (smoothedFocus < 50) {
      mode = "end_session";
      shouldEndSession = true;
      interventionText = "Let's take a break and review.";
    } else {
      mode = "simplify";
      interventionText = "Let me explain this a different way.";
    }
  }

  return { mode, interventionText, shouldEndSession, timestamp: now };
}

export default function DevAttentionMonitorPage() {
  const [signals, setSignals] = useState<FocusSignals>({
    gazeScore: 100,
    headPoseScore: 100,
    tabVisibilityScore: 100,
    responseLatencyScore: 100,
    blinkHealthScore: 100,
    interactionScore: 100,
  });
  const [rawScore, setRawScore] = useState(100);
  const [smoothedScore, setSmoothedScore] = useState(100);
  const [calibration, setCalibration] = useState<CalibrationState>(createCalibrationState);
  const [policyLog, setPolicyLog] = useState<PolicyDecision[]>([]);
  const [timeline, setTimeline] = useState<{ timestamp: number; score: number }[]>([]);

  const hiddenSinceRef = useRef<number | null>(null);
  const lastQuestionAtRef = useRef<number | null>(null);
  const lastResponseAtRef = useRef<number | null>(null);
  const lastInputRef = useRef(Date.now());
  const meshSignalsRef = useRef<FaceMeshSignals>({ gazeScore: 100, headPoseScore: 100, blinkHealthScore: 100 });
  const smoothedRef = useRef(100);
  const calibrationRef = useRef(calibration);
  useEffect(() => {
    calibrationRef.current = calibration;
  }, [calibration]);

  const handleMeshSignals = useCallback((s: FaceMeshSignals) => {
    // #region agent log
    const payload = { sessionId: '8f585b', hypothesisId: 'H4', location: 'attention-monitor:handleMeshSignals', message: 'mesh signals received', data: { gaze: s.gazeScore, headPose: s.headPoseScore, blink: s.blinkHealthScore }, timestamp: Date.now() };
    fetch('http://127.0.0.1:7886/ingest/2f30cf97-2589-4660-89b3-3083075b669c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8f585b'},body:JSON.stringify(payload)}).catch(()=>{});
    if (typeof window !== 'undefined') console.debug('[debug H4]', payload);
    // #endregion
    meshSignalsRef.current = s;
    setCalibration((prev) => {
      if (prev.completed) return prev;
      return addCalibrationSample(prev, s.gazeScore, s.headPoseScore, s.blinkHealthScore);
    });
  }, []);

  const webcam = useWebcamAttention(true, () => {}, handleMeshSignals);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) hiddenSinceRef.current = Date.now();
      else hiddenSinceRef.current = null;
    }
    function onUserInput() {
      lastInputRef.current = Date.now();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("mousemove", onUserInput);
    document.addEventListener("keydown", onUserInput);
    document.addEventListener("click", onUserInput);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("mousemove", onUserInput);
      document.removeEventListener("keydown", onUserInput);
      document.removeEventListener("click", onUserInput);
    };
  }, []);

  const scoreTickCountRef = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const mesh = meshSignalsRef.current;

      const currentSignals: FocusSignals = {
        gazeScore: mesh.gazeScore,
        headPoseScore: mesh.headPoseScore,
        blinkHealthScore: mesh.blinkHealthScore,
        tabVisibilityScore: computeTabVisibilityScore(!document.hidden, hiddenSinceRef.current, now),
        responseLatencyScore: computeResponseLatencyScore(
          lastQuestionAtRef.current,
          lastResponseAtRef.current,
          now
        ),
        interactionScore: computeInteractionScore(lastInputRef.current, now),
      };

      setSignals(currentSignals);

      const cal = calibrationRef.current;
      const mult = cal.completed ? cal.multiplier : 1.0;
      const raw = computeRawFocusScore(currentSignals, mult);
      const smoothed = applyEMA(smoothedRef.current, raw);
      smoothedRef.current = smoothed;

      scoreTickCountRef.current += 1;
      // #region agent log
      const h1 = { sessionId: '8f585b', hypothesisId: 'H1', location: 'attention-monitor:scoreTick', message: '5s score tick', data: { tick: scoreTickCountRef.current, raw, smoothed, mult, calCompleted: cal.completed }, timestamp: Date.now() };
      const h2 = { sessionId: '8f585b', hypothesisId: 'H2', location: 'attention-monitor:scoreTick', message: 'calibration ref in tick', data: { mult, calCompleted: cal.completed, sampleCount: cal.samples.length }, timestamp: Date.now() };
      fetch('http://127.0.0.1:7886/ingest/2f30cf97-2589-4660-89b3-3083075b669c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8f585b'},body:JSON.stringify(h1)}).catch(()=>{});
      fetch('http://127.0.0.1:7886/ingest/2f30cf97-2589-4660-89b3-3083075b669c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8f585b'},body:JSON.stringify(h2)}).catch(()=>{});
      if (typeof window !== 'undefined') { console.debug('[debug H1]', h1); console.debug('[debug H2]', h2); }
      // #endregion

      setRawScore(raw);
      setSmoothedScore(smoothed);
      // #region agent log
      const h5 = { sessionId: '8f585b', hypothesisId: 'H5', location: 'attention-monitor:timeline', message: 'timeline append', data: { appendedScore: smoothed }, timestamp: Date.now() };
      fetch('http://127.0.0.1:7886/ingest/2f30cf97-2589-4660-89b3-3083075b669c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8f585b'},body:JSON.stringify(h5)}).catch(()=>{});
      if (typeof window !== 'undefined') console.debug('[debug H5]', h5);
      // #endregion
      setTimeline((prev) => [...prev.slice(-60), { timestamp: now, score: smoothed }]);
    }, SCORE_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const policyTickCountRef = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      const decision = computePolicyDecision(smoothedScore, 100);
      policyTickCountRef.current += 1;
      // #region agent log
      const h3 = { sessionId: '8f585b', hypothesisId: 'H3', location: 'attention-monitor:policyTick', message: '30s policy tick', data: { tick: policyTickCountRef.current, smoothedScore, mode: decision.mode }, timestamp: Date.now() };
      fetch('http://127.0.0.1:7886/ingest/2f30cf97-2589-4660-89b3-3083075b669c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8f585b'},body:JSON.stringify(h3)}).catch(()=>{});
      if (typeof window !== 'undefined') console.debug('[debug H3]', h3);
      // #endregion
      setPolicyLog((prev) => [...prev.slice(-9), decision]);
    }, POLICY_TICK_MS);
    return () => clearInterval(interval);
  }, [smoothedScore]);

  const weightedSum =
    signals.gazeScore * W.gaze +
    signals.headPoseScore * W.headPose +
    signals.tabVisibilityScore * W.tabVisibility +
    signals.responseLatencyScore * W.responseLatency +
    signals.blinkHealthScore * W.blinkHealth +
    signals.interactionScore * W.interaction;
  const multiplier = calibration.completed ? calibration.multiplier : 1.0;
  const chartData = timeline.map((e) => ({
    time: new Date(e.timestamp).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
    score: e.score,
    full: e.timestamp,
  }));

  const signalRows: { label: string; value: number; weight: number; key: keyof FocusSignals }[] = [
    { label: "Gaze", value: signals.gazeScore, weight: W.gaze, key: "gazeScore" },
    { label: "Head Pose", value: signals.headPoseScore, weight: W.headPose, key: "headPoseScore" },
    { label: "Tab Visible", value: signals.tabVisibilityScore, weight: W.tabVisibility, key: "tabVisibilityScore" },
    { label: "Response", value: signals.responseLatencyScore, weight: W.responseLatency, key: "responseLatencyScore" },
    { label: "Blink", value: signals.blinkHealthScore, weight: W.blinkHealth, key: "blinkHealthScore" },
    { label: "Interaction", value: signals.interactionScore, weight: W.interaction, key: "interactionScore" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f14", color: "#e5e5e5", fontFamily: "'SF Mono', 'Fira Code', monospace", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#c8416a" }}>
          Attention Engine Monitor
        </h1>
        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 24 }}>
          /dev/attention-monitor — same pipeline as session, no API calls. Data every 5s; policy every 30s.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <section style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 12 }}>SIGNALS × WEIGHTS</h2>
            {signalRows.map(({ label, value, weight }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 11 }}>
                <span style={{ width: 90 }}>{label}</span>
                <span style={{ width: 36, textAlign: "right" }}>{value}</span>
                <span style={{ opacity: 0.5 }}>× {weight}</span>
                <span style={{ color: "#8b5cf6" }}>= {(value * weight).toFixed(1)}</span>
              </div>
            ))}
          </section>

          <section style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 12 }}>FORMULA</h2>
            <div style={{ fontSize: 11, lineHeight: 1.8 }}>
              <div>Sum = G×0.30 + H×0.20 + T×0.15 + R×0.15 + B×0.10 + I×0.10</div>
              <div style={{ color: "#8b5cf6" }}>Sum = {weightedSum.toFixed(1)}</div>
              <div>Raw = sum × multiplier = {weightedSum.toFixed(1)} × {multiplier.toFixed(2)} = {rawScore}</div>
              <div style={{ marginTop: 8 }}>EMA: {EMA_PREV}×prev + {EMA_RAW}×raw = smoothed</div>
              <div style={{ color: "#10b981" }}>Smoothed = {smoothedScore}</div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ padding: "8px 12px", background: "rgba(16,185,129,0.15)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#10b981" }}>{smoothedScore}</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>Focus</div>
              </div>
              <div style={{ padding: "8px 12px", background: "rgba(139,92,246,0.1)", borderRadius: 8, border: "1px solid rgba(139,92,246,0.25)" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#a78bfa" }}>{multiplier.toFixed(2)}</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>Multiplier</div>
              </div>
              <div style={{ padding: "8px 12px", background: "rgba(245,158,11,0.1)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.25)" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fbbf24" }}>{rawScore}</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>Raw</div>
              </div>
            </div>
          </section>
        </div>

        <section style={{ marginTop: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 12 }}>CALIBRATION</h2>
          <div style={{ fontSize: 11 }}>
            {calibration.completed
              ? <>Completed. Multiplier = {calibration.multiplier.toFixed(3)} (from {calibration.samples.length} samples)</>
              : <>Calibrating… {calibration.samples.length} samples (need ~2 min)</>
            }
          </div>
        </section>

        <section style={{ marginTop: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 12 }}>POLICY LOG (30s tick)</h2>
          {policyLog.length === 0 ? (
            <div style={{ fontSize: 11, opacity: 0.5 }}>No decisions yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {policyLog.slice().reverse().map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                  <span style={{ opacity: 0.5 }}>{new Date(d.timestamp).toLocaleTimeString()}</span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontWeight: 600,
                      fontSize: 10,
                      background: d.mode === "normal" ? "rgba(16,185,129,0.2)" : d.mode === "gentle_checkin" ? "rgba(245,158,11,0.2)" : d.mode === "micro_task" ? "rgba(239,68,68,0.2)" : "rgba(139,92,246,0.2)",
                      color: d.mode === "normal" ? "#10b981" : d.mode === "gentle_checkin" ? "#f59e0b" : d.mode === "micro_task" ? "#ef4444" : "#a78bfa",
                    }}
                  >
                    {d.mode}
                  </span>
                  {d.interventionText && <span style={{ opacity: 0.8 }}>{d.interventionText}</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.08)", height: 260 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 12 }}>FOCUS TIMELINE (last ~5 min)</h2>
          {chartData.length < 2 ? (
            <div style={{ fontSize: 11, opacity: 0.5 }}>Waiting for data…</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.3)" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.3)" />
                <Tooltip
                  contentStyle={{ background: "#1a1a22", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                  labelStyle={{ color: "#e5e5e5" }}
                  formatter={(value: number) => [value, "Focus"]}
                />
                <ReferenceLine y={80} stroke="rgba(16,185,129,0.4)" strokeDasharray="2 2" />
                <ReferenceLine y={50} stroke="rgba(245,158,11,0.4)" strokeDasharray="2 2" />
                <Line type="monotone" dataKey="score" stroke="#c8416a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>

        <section style={{ marginTop: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 8 }}>WEBCAM</h2>
          <p style={{ fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
            {webcam.webcamEnabled ? "Face mesh active (10fps). Signals feed the formula above." : "Enable webcam for gaze/head pose/blink."}
          </p>
          {webcam.permissionDenied && (
            <p style={{ fontSize: 11, color: "#ef4444" }}>Camera permission denied</p>
          )}
        </section>
      </div>
    </div>
  );
}
