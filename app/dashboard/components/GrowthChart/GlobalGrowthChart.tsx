"use client";

import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  year?: number;
};

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function GlobalGrowthChart({ year = new Date().getFullYear() }: Props) {
  const chartData = useMemo(
    () =>
      months.map((month, index) => ({
        month,
        total: 1_200_000 + index * 180_000 + (year % 7) * 45_000,
      })),
    [year]
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value) => `UGX ${Number(value).toLocaleString()}`} />
        <Line dataKey="total" stroke="#2563eb" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
