"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/app/lib/supabase/client";

type NotificationPayload = {
  id?: string;
  title?: string;
  message?: string;
  created_at?: string;
  [key: string]: unknown;
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);

  useEffect(() => {
    const channel = supabaseBrowser
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications((prev) => [
            payload.new as NotificationPayload,
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  return notifications;
}
