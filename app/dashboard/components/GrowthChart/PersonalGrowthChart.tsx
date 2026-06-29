"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabaseBrowser } from "@/app/lib/supabase/client";
import { useGrowthRealtime } from "./useGrowthRealtime";

type Row = {
  month: string;
  total: number;
};

export function PersonalGrowthChart() {
  const [data, setData] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabaseBrowser
      .from("monthly_contributions")
      .select("month, amount");

    if (!data) return;

    const grouped: Record<string, number> = {};
    data.forEach((r) => {
      grouped[r.month] = (grouped[r.month] || 0) + r.amount;
    });

    setData(
      Object.entries(grouped).map(([month, total]) => ({
        month,
        total,
      }))
    );
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(initialLoad);
  }, [load]);

  useGrowthRealtime("monthly_contributions", load);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Line
          dataKey="total"
          stroke="#2563eb"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
