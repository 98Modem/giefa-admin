"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/app/lib/supabase/client";

const INACTIVITY_TOTAL_MS = 15 * 60 * 1000;
const COUNTDOWN_SECONDS = 60;
const WARNING_DELAY_MS = INACTIVITY_TOTAL_MS - COUNTDOWN_SECONDS * 1000;

export function useInactivityLogout() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showPrompt, setShowPrompt] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const logout = useCallback(async () => {
    clearTimers();

    await supabaseBrowser.auth.signOut({
      scope: "global",
    });

    window.location.assign("/login?reason=inactive");
  }, [clearTimers]);

  const resetTimer = useCallback(() => {
    clearTimers();
    setShowPrompt(false);
    setCountdown(COUNTDOWN_SECONDS);

    timeoutRef.current = setTimeout(() => {
      setShowPrompt(true);

      intervalRef.current = setInterval(() => {
        setCountdown((previous) => {
          if (previous <= 1) {
            void logout();
            return 0;
          }

          return previous - 1;
        });
      }, 1000);
    }, WARNING_DELAY_MS);
  }, [clearTimers, logout]);

  useEffect(() => {
    const events = [
      "pointermove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    const initialTimer = window.setTimeout(resetTimer, 0);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
      window.clearTimeout(initialTimer);
      clearTimers();
    };
  }, [clearTimers, resetTimer]);

  return {
    showPrompt,
    countdown,
    continueSession: resetTimer,
  };
}
