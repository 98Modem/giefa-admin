"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/app/lib/supabase/client";

export function useGrowthRealtime(
  table: string,
  onChange: () => void
) {
  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`realtime-${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onChange()
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [table, onChange]);
}
