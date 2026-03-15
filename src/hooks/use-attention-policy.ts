"use client";

/**
 * useAttentionPolicy — runs every 30s, reads SmoothedFocus + ContentConfidence,
 * decides tutor behavior and triggers interventions.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { PolicyDecision, PolicyMode, ContentConfidenceState } from "@/types";

const POLICY_CHECK_MS = 30_000;

interface PolicyConfig {
  childName: string;
  sessionId: string;
  kidSessionId: string;
}

export function useAttentionPolicy(
  smoothedFocus: number,
  contentConfidence: ContentConfidenceState | null,
  config: PolicyConfig,
  onIntervention: (text: string) => void,
  onEndSession: () => void
) {
  const [currentPolicy, setCurrentPolicy] = useState<PolicyDecision>({
    mode: "normal",
    interventionText: null,
    shouldEndSession: false,
    timestamp: Date.now(),
  });

  const [policyLog, setPolicyLog] = useState<PolicyDecision[]>([]);
  const consecutiveLowRef = useRef(0);
  const alertSentRef = useRef(false);

  const evaluate = useCallback(() => {
    const now = Date.now();
    const cc = contentConfidence?.overall ?? 100;
    let mode: PolicyMode = "normal";
    let interventionText: string | null = null;
    let shouldEndSession = false;

    // Focus-based decisions
    if (smoothedFocus >= 80) {
      mode = "normal";
      consecutiveLowRef.current = 0;
    } else if (smoothedFocus >= 50) {
      mode = "gentle_checkin";
      consecutiveLowRef.current = 0;
      interventionText = `Hey ${config.childName}! Let's keep going — you were doing great!`;
    } else {
      // Focus < 50
      consecutiveLowRef.current++;
      mode = "micro_task";
      interventionText = `${config.childName}, let's try one quick step at a time. You got this!`;

      // Two consecutive low checks → email alert
      if (consecutiveLowRef.current >= 2 && !alertSentRef.current) {
        alertSentRef.current = true;
        void fetch("/api/focus/alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: config.sessionId,
            focusScore: smoothedFocus,
            consecutiveLowChecks: consecutiveLowRef.current,
          }),
        }).catch(() => {});
      }
    }

    // Content confidence decisions
    if (cc < 40) {
      if (smoothedFocus < 50) {
        // Both low → end session gracefully
        mode = "end_session";
        shouldEndSession = true;
        interventionText = `Great effort today, ${config.childName}! Let's take a break and review what we covered.`;

        // Send parent summary email
        void fetch("/api/focus/alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: config.sessionId,
            focusScore: smoothedFocus,
            consecutiveLowChecks: consecutiveLowRef.current,
            contentConfidence: cc,
            endSession: true,
          }),
        }).catch(() => {});
      } else {
        mode = "simplify";
        interventionText = `Let me explain this a different way, ${config.childName}. Think of it like this...`;
      }
    }

    const decision: PolicyDecision = {
      mode,
      interventionText,
      shouldEndSession,
      timestamp: now,
    };

    setCurrentPolicy(decision);
    setPolicyLog((prev) => [...prev.slice(-9), decision]); // Keep last 10

    if (interventionText) {
      onIntervention(interventionText);
    }

    if (shouldEndSession) {
      onEndSession();
    }
  }, [smoothedFocus, contentConfidence, config, onIntervention, onEndSession]);

  useEffect(() => {
    const interval = setInterval(evaluate, POLICY_CHECK_MS);
    return () => clearInterval(interval);
  }, [evaluate]);

  return { currentPolicy, policyLog };
}
