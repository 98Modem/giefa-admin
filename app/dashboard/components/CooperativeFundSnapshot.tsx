"use client";

import { motion } from "framer-motion";
import { Role } from "@/app/employee_type/roles";

type Props = {
  role: Role;
  totalContributions: number;
  emergencyFund: number;
  investmentFund: number;
  personalContributions: number;
  activeMembers: number;
};

function money(value: number) {
  return `UGX ${Number(value ?? 0).toLocaleString()}`;
}

export function CooperativeFundSnapshot({
  role,
  totalContributions,
  emergencyFund,
  investmentFund,
  personalContributions,
  activeMembers,
}: Props) {
  const total = Math.max(totalContributions, emergencyFund + investmentFund, 1);
  const emergencyPercent = Math.round((emergencyFund / total) * 100);
  const investmentPercent = Math.round((investmentFund / total) * 100);
  const personalPercent = Math.min(
    Math.round((personalContributions / total) * 100),
    100
  );
  const isMember = role === "member";

  const items = [
    {
      label: "Emergency reserve",
      value: emergencyFund,
      percent: emergencyPercent,
      tone: "bg-emerald-500",
    },
    {
      label: "Investment pool",
      value: investmentFund,
      percent: investmentPercent,
      tone: "bg-brand-500",
    },
    {
      label: isMember ? "My share of visible pool" : "Member participation",
      value: isMember ? personalContributions : activeMembers,
      percent: isMember ? personalPercent : Math.min(activeMembers * 4, 100),
      tone: "bg-amber-500",
      isCount: !isMember,
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-gray-900/80">
      <div className="grid min-w-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="relative overflow-hidden bg-brand-950 p-6 text-white">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-brand-400/20 blur-3xl" />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-100">
              Cooperative savings position
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              {money(totalContributions)}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/75">
              {isMember
                ? "Your personal position is shown beside association-level progress to encourage transparency without exposing other members."
                : "Leadership can monitor liquidity, investment strength, and participation from one operating view."}
            </p>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {items.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.35 }}
            >
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-300">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-gray-950 dark:text-white">
                    {item.isCount ? `${item.value} active` : money(item.value)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {item.percent}%
                </p>
              </div>

              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                <motion.div
                  className={`h-full rounded-full ${item.tone}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percent}%` }}
                  transition={{ delay: 0.15 + index * 0.08, duration: 0.7 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
