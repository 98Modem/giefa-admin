"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Role } from "@/app/employee_type/roles";
import { isTopManagement } from "../../config/fundVisibility";

export type GrowthPoint = {
  month: string;
  personal: number;
  collective: number;
  emergency: number;
  investment: number;
};

type ChartView = "personal" | "collective" | "allocation";

type Props = {
  role: Role;
  data: GrowthPoint[];
};

const viewLabels: Record<ChartView, string> = {
  personal: "My growth",
  collective: "Cooperative growth",
  allocation: "Fund allocation",
};

function money(value: number) {
  return `UGX ${Number(value ?? 0).toLocaleString()}`;
}

export function GrowthChart({ role, data }: Props) {
  const views = useMemo<ChartView[]>(() => {
    if (isTopManagement(role)) return ["collective", "allocation", "personal"];
    if (role === "member") return ["personal", "collective"];
    return ["personal"];
  }, [role]);
  const [view, setView] = useState<ChartView>(views[0]);
  const safeData = data.length > 0 ? data : emptyData;

  return (
    <div className="min-w-0 rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-900/80 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
            Savings growth
          </p>
          <h3 className="mt-1 text-lg font-semibold text-gray-950 dark:text-white">
            {viewLabels[view]}
          </h3>
          <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-gray-300">
            {view === "personal"
              ? "Monthly movement for the signed-in member."
              : view === "collective"
                ? "Association-level progress shown as a transparent cooperative total."
                : "Emergency and investment allocations compared by month."}
          </p>
        </div>

        <div className="inline-flex w-full rounded-xl border bg-gray-50 p-1 dark:bg-white/5 sm:w-auto">
          {views.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setView(candidate)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition sm:flex-none ${
                view === candidate
                  ? "bg-white text-brand-700 shadow-sm dark:bg-brand-500/20 dark:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              {viewLabels[candidate]}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-80 min-w-0 overflow-hidden xl:h-[24rem]">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.985 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute inset-0"
          >
            {view === "allocation" ? (
              <AllocationChart data={safeData} />
            ) : (
              <SavingsAreaChart data={safeData} dataKey={view} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SavingsAreaChart({
  data,
  dataKey,
}: {
  data: GrowthPoint[];
  dataKey: "personal" | "collective";
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#465fff" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#465fff" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} opacity={0.18} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={(value) => `${Number(value) / 1000000}M`}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip formatter={(value) => money(Number(value))} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke="#465fff"
          strokeWidth={3}
          fill="url(#growthFill)"
          activeDot={{ r: 6 }}
          animationDuration={900}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function AllocationChart({ data }: { data: GrowthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" vertical={false} opacity={0.18} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={(value) => `${Number(value) / 1000000}M`}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip formatter={(value) => money(Number(value))} />
        <Bar
          dataKey="emergency"
          name="Emergency"
          stackId="funds"
          fill="#10b981"
          radius={[8, 8, 0, 0]}
          animationDuration={850}
        />
        <Bar
          dataKey="investment"
          name="Investment"
          stackId="funds"
          fill="#465fff"
          radius={[8, 8, 0, 0]}
          animationDuration={850}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const emptyData: GrowthPoint[] = [
  { month: "No data", personal: 0, collective: 0, emergency: 0, investment: 0 },
];
