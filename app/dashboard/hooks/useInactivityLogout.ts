"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/app/lib/supabase/client";

const INACTIVITY_TOTAL_MS = 15 * 60 * 1000;
const COUNTDOWN_SECONDS = 60;
const WARNING_DELAY_MS = INACTIVITY_TOTAL_MS - COUNTDOWN_SECONDS * 1000;
const SIGN_OUT_BEACON_URL = "/api/auth/end-session";

function clearSupabaseBrowserCookies() {
  const hostnameParts = window.location.hostname.split(".");
  const domains = [
    undefined,
    window.location.hostname,
    hostnameParts.length > 1 ? `.${hostnameParts.slice(-2).join(".")}` : undefined,
  ].filter(Boolean) as string[];

  document.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name))
    .filter((name) => name.startsWith("sb-") || name.includes("supabase"))
    .forEach((name) => {
      const base = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = base;
      domains.forEach((domain) => {
        document.cookie = `${base}; domain=${domain}`;
      });
    });
}

function endSessionOnTabClose() {
  clearSupabaseBrowserCookies();

  if (navigator.sendBeacon) {
    const payload = new Blob([JSON.stringify({ reason: "tab_closed" })], {
      type: "application/json",
    });
    navigator.sendBeacon(SIGN_OUT_BEACON_URL, payload);
    return;
  }

  void fetch(SIGN_OUT_BEACON_URL, {
    method: "POST",
    body: JSON.stringify({ reason: "tab_closed" }),
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  });
}

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

  useEffect(() => {
    const handlePageHide = () => {
      endSessionOnTabClose();
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  return {
    showPrompt,
    countdown,
    continueSession: resetTimer,
  };
}
