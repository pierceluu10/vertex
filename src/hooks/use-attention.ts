"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  createInitialAttentionState,
  handleTabBlur,
  handleTabFocus,
  handleActivity,
  handleInactivityCheck,
  handleNoFace,
  handleLookingAway,
  handleFaceReturn,
  getIntervention,
} from "@/lib/attention";
import { ATTENTION_CONFIG } from "@/lib/attention-config";
import { useWebcamAttention } from "./use-webcam-attention";
import type { AttentionState } from "@/types";

const SESSION_SCORE_SAMPLE_INTERVAL_MS = 10_000;

export function useAttention(
  sessionId: string,
  onIntervention: (type: string) => void,
  webcamEnabled = true
) {
  const [attention, setAttention] = useState<AttentionState>(
    createInitialAttentionState()
  );
  const stateRef = useRef(attention);
  const lastInterventionAtRef = useRef<number>(0);
  const scoreSamplesRef = useRef<number[]>([]);

  useEffect(() => {
    stateRef.current = attention;
  }, [attention]);

  const logFocusEvent = useCallback(
    async (eventType: string, durationMs?: number) => {
      try {
        await fetch("/api/focus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, eventType, durationMs }),
        });
      } catch {
        // Non-critical
      }
    },
    [sessionId]
  );

  const handleFaceEvent = useCallback(
    (event: "FACE_PRESENT" | "NO_FACE" | "LOOKING_AWAY" | "HEAD_TURNED") => {
      switch (event) {
        case "NO_FACE":
          setAttention((prev) => handleNoFace(prev));
          logFocusEvent("face_absent");
          break;
        case "LOOKING_AWAY":
          setAttention((prev) => handleLookingAway(prev));
          logFocusEvent("face_absent");
          break;
        case "FACE_PRESENT":
          setAttention((prev) => handleFaceReturn(prev));
          break;
        case "HEAD_TURNED":
          setAttention((prev) => handleLookingAway(prev));
          logFocusEvent("face_absent");
          break;
      }
    },
    [logFocusEvent]
  );

  const webcam = useWebcamAttention(webcamEnabled, handleFaceEvent);

  useEffect(() => {
    let blurTimestamp: number | null = null;

    function onVisibilityChange() {
      if (document.hidden) {
        blurTimestamp = Date.now();
        setAttention((prev) => handleTabBlur(prev));
      } else {
        const duration = blurTimestamp ? Date.now() - blurTimestamp : undefined;
        logFocusEvent("tab_blur", duration);
        blurTimestamp = null;
        setAttention((prev) => handleTabFocus(prev));
      }
    }

    function onWindowBlur() {
      setAttention((prev) => handleTabBlur(prev));
    }

    function onWindowFocus() {
      setAttention((prev) => handleTabFocus(prev));
    }

    function onUserActivity() {
      setAttention((prev) => handleActivity(prev));
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("mousemove", onUserActivity);
    document.addEventListener("keydown", onUserActivity);
    document.addEventListener("click", onUserActivity);
    document.addEventListener("touchstart", onUserActivity);

    const inactivityInterval = setInterval(() => {
      setAttention((prev) => {
        const next = handleInactivityCheck(prev);
        if (next.score !== prev.score && next.score < prev.score) {
          logFocusEvent("inactive");
        }
        return next;
      });
    }, ATTENTION_CONFIG.INACTIVITY_CHECK_INTERVAL_MS);

    let consecutiveLowChecks = 0;

    const interventionInterval = setInterval(() => {
      const now = Date.now();

      // Track consecutive low focus for email alerts
      if (stateRef.current.score < 50) {
        consecutiveLowChecks++;
        if (consecutiveLowChecks >= 2) {
          fetch("/api/focus/alert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              focusScore: stateRef.current.score,
              consecutiveLowChecks,
            }),
          }).catch(() => {});
          consecutiveLowChecks = 0; // Reset after sending
        }
      } else {
        consecutiveLowChecks = 0;
      }

      if (now - lastInterventionAtRef.current < ATTENTION_CONFIG.INTERVENTION_COOLDOWN_MS) {
        return;
      }
      const intervention = getIntervention(stateRef.current);
      if (intervention) {
        lastInterventionAtRef.current = now;
        onIntervention(intervention);
      }
    }, ATTENTION_CONFIG.INTERVENTION_CHECK_INTERVAL_MS);

    // Sample focus score periodically so we can report a session average (avoids
    // "End" click bumping score back to 100 after tab focus/activity recovery)
    const sampleInterval = setInterval(() => {
      scoreSamplesRef.current.push(stateRef.current.score);
    }, SESSION_SCORE_SAMPLE_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("mousemove", onUserActivity);
      document.removeEventListener("keydown", onUserActivity);
      document.removeEventListener("click", onUserActivity);
      document.removeEventListener("touchstart", onUserActivity);
      clearInterval(inactivityInterval);
      clearInterval(interventionInterval);
      clearInterval(sampleInterval);
    };
  }, [logFocusEvent, onIntervention]);

  function getSessionAverageScore(): number {
    const samples = scoreSamplesRef.current;
    const current = stateRef.current.score;
    if (samples.length === 0) return current;
    const sum = samples.reduce((a, b) => a + b, 0) + current;
    return Math.round(sum / (samples.length + 1));
  }

  return { ...attention, webcam, getSessionAverageScore };
}
