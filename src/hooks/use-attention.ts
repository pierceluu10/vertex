"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  createInitialAttentionState,
  handleTabBlur,
  handleTabFocus,
  handleActivity,
  handleInactivityCheck,
  getIntervention,
} from "@/lib/attention";
import type { AttentionState } from "@/types";

export function useAttention(
  sessionId: string,
  onIntervention: (type: string) => void
) {
  const [attention, setAttention] = useState<AttentionState>(
    createInitialAttentionState()
  );
  const stateRef = useRef(attention);

  useEffect(() => {
    stateRef.current = attention;
  }, [attention]);

  const logFocusEvent = useCallback(
    async (eventType: string, durationMs?: number) => {
      try {
        await fetch("/api/focus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            eventType,
            durationMs,
          }),
        });
      } catch {
        // Non-critical — don't block UI
      }
    },
    [sessionId]
  );

  useEffect(() => {
    let blurTimestamp: number | null = null;

    function onVisibilityChange() {
      if (document.hidden) {
        blurTimestamp = Date.now();
        setAttention((prev) => {
          const next = handleTabBlur(prev);
          return next;
        });
      } else {
        const duration = blurTimestamp ? Date.now() - blurTimestamp : undefined;
        logFocusEvent("tab_blur", duration);
        blurTimestamp = null;
        setAttention((prev) => handleTabFocus(prev));
      }
    }

    function onUserActivity() {
      setAttention((prev) => handleActivity(prev));
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
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
    }, 10_000);

    const interventionInterval = setInterval(() => {
      const intervention = getIntervention(stateRef.current);
      if (intervention) {
        onIntervention(intervention);
      }
    }, 15_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("mousemove", onUserActivity);
      document.removeEventListener("keydown", onUserActivity);
      document.removeEventListener("click", onUserActivity);
      document.removeEventListener("touchstart", onUserActivity);
      clearInterval(inactivityInterval);
      clearInterval(interventionInterval);
    };
  }, [logFocusEvent, onIntervention]);

  return attention;
}
