import { redirect } from "next/navigation";
import { supabaseServer } from "../lib/supabase/server";
import { ROLE_CAPABILITIES } from "./config/roleCapabilities";
import { MemberRow } from "../types/member";
import {
  getEmergencyFunds,
  getMembers,
  getMonthlyContributions,
  getShares,
  money,
} from "../lib/giefa/liveData";

import { StatCard } from "./components/StatCard";
import { FundOverview } from "./components/FundOverview";
import {
  GrowthChart,
  GrowthPoint,
} from "./components/GrowthChart/GrowthChart";
import { RequestsTable } from "./components/RequestsTable";
import { ActivityFeed } from "./components/ActivityFeed";
import { FundAccessPanel } from "./components/FundAccessPanel";
import { CooperativeFundSnapshot } from "./components/CooperativeFundSnapshot";
import { FUND_VISIBILITY, isTopManagement } from "./config/fundVisibility";

export default async function DashboardPage() {
  const supabase = await supabaseServer();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const { data: member, error } = await supabase
    .from("members")
    .select("id, first_name, status, role")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<MemberRow>();

  if (error || !member) redirect("/login");
  if (member.status === "suspended") redirect("/account-suspended");
  if (member.status !== "approved") redirect("/pending-approval");

  const permissions = ROLE_CAPABILITIES[member.role];
  const fundVisibility = FUND_VISIBILITY[member.role];
  const topManagement = isTopManagement(member.role);
  const roleLabel = member.role.replace("_", " ");
  const [contributions, emergencyFunds, shares, activeMembers] =
    await Promise.all([
      getMonthlyContributions(),
      getEmergencyFunds(),
      getShares(),
      getMembers("approved"),
    ]);

  const personalContributions = contributions.filter(
    (row) => row.member_id === member.id
  );
  const personalEmergencyRows = emergencyFunds.filter(
    (row) => row.member_id === member.id
  );
  const personalShareRows = shares.filter((row) => row.member_id === member.id);

  const totalContributions = sumNumbers(contributions.map((row) => row.amount));
  const personalContributionTotal = sumNumbers(
    personalContributions.map((row) => row.amount)
  );
  const emergencyFundTotal =
    sumNumbers(emergencyFunds.map((row) => row.available)) ||
    sumNumbers(contributions.map((row) => row.emergency_amount));
  const investmentFundTotal =
    sumNumbers(shares.map((row) => row.total_amount)) ||
    sumNumbers(contributions.map((row) => row.investment_amount));
  const personalEmergencyTotal =
    sumNumbers(personalEmergencyRows.map((row) => row.available)) ||
    sumNumbers(personalContributions.map((row) => row.emergency_amount));
  const personalInvestmentTotal =
    sumNumbers(personalShareRows.map((row) => row.total_amount)) ||
    sumNumbers(personalContributions.map((row) => row.investment_amount));
  const growthData = buildGrowthData(contributions, member.id);

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900/80 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
              Association workspace
            </p>
            <h1 className="mt-2 text-2xl font-bold text-gray-950 dark:text-white sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Welcome back, {member.first_name}. Your current access is{" "}
              <span className="font-semibold capitalize text-gray-900 dark:text-white">
                {roleLabel}
              </span>
              .
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-500/30 dark:bg-brand-500/10">
              <p className="text-xs font-medium text-brand-700 dark:text-brand-200">
                Status
              </p>
              <p className="mt-1 text-sm font-semibold capitalize text-gray-950 dark:text-white">
                {member.status}
              </p>
            </div>
            <div className="rounded-xl border bg-white px-4 py-3 dark:bg-white/5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
                Visibility
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-950 dark:text-white">
                {fundVisibility.label}
              </p>
            </div>
          </div>
        </div>
      </section>

      {permissions.canViewFinanceStats && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title={topManagement ? "Total Contributions" : "My Contributions"}
            value={money(topManagement ? totalContributions : personalContributionTotal)}
            detail={
              topManagement
                ? "All visible cooperative deposits"
                : "Your recorded savings deposits"
            }
          />
          <StatCard
            title={topManagement ? "Emergency Reserve" : "My Emergency Fund"}
            value={money(topManagement ? emergencyFundTotal : personalEmergencyTotal)}
            detail={
              topManagement
                ? "Liquidity available for member support"
                : "Your available safety balance"
            }
          />
          <StatCard
            title={topManagement ? "Investment Pool" : "My Investment Fund"}
            value={money(topManagement ? investmentFundTotal : personalInvestmentTotal)}
            detail={
              topManagement
                ? "Visible long-term growth capital"
                : "Your investment/share value"
            }
          />
        </section>
      )}

      {fundVisibility.collective && (
        <CooperativeFundSnapshot
          role={member.role}
          totalContributions={totalContributions}
          emergencyFund={emergencyFundTotal}
          investmentFund={investmentFundTotal}
          personalContributions={personalContributionTotal}
          activeMembers={activeMembers.length}
        />
      )}

      {(permissions.canViewGrowthChart || permissions.canViewFundOverview) && (
        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          {permissions.canViewGrowthChart && (
            <GrowthChart role={member.role} data={growthData} />
          )}
          {permissions.canViewFundOverview && (
            <FundOverview
              role={member.role}
              emergencyFund={emergencyFundTotal}
              investmentFund={investmentFundTotal}
              personalEmergency={personalEmergencyTotal}
              personalInvestment={personalInvestmentTotal}
            />
          )}
        </section>
      )}

      <FundAccessPanel role={member.role} />

      <section className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        {permissions.canViewRequestsTable && (
          <RequestsTable role={member.role} memberId={member.id} />
        )}

        <div className="grid min-w-0 content-start gap-6">
          {permissions.canViewActivityFeed && <ActivityFeed />}

          {permissions.canViewReports && (
            <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-900/80 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                Intelligence
              </p>
              <h3 className="mt-2 text-lg font-semibold text-gray-950 dark:text-white">
                Reports & Analytics
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-300">
                Monthly growth, savings trends, request exposure, and fund
                performance for leadership review.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function sumNumbers(values: Array<number | null | undefined>): number {
  return values.reduce<number>(
    (total, value) => total + Number(value ?? 0),
    0
  );
}

function buildGrowthData(
  rows: Array<{
    member_id: string;
    month: string | null;
    amount: number | null;
    emergency_amount: number | null;
    investment_amount: number | null;
    created_at: string | null;
  }>,
  memberId: string
): GrowthPoint[] {
  const grouped = new Map<string, GrowthPoint>();

  rows.forEach((row) => {
    const month = normalizeMonth(row.month, row.created_at);
    const current =
      grouped.get(month) ??
      ({
        month,
        personal: 0,
        collective: 0,
        emergency: 0,
        investment: 0,
      } satisfies GrowthPoint);

    const amount = Number(row.amount ?? 0);
    current.collective += amount;
    current.emergency += Number(row.emergency_amount ?? 0);
    current.investment += Number(row.investment_amount ?? 0);

    if (row.member_id === memberId) {
      current.personal += amount;
    }

    grouped.set(month, current);
  });

  return Array.from(grouped.values()).sort(
    (a, b) => monthSortValue(a.month) - monthSortValue(b.month)
  );
}

function normalizeMonth(month: string | null, createdAt: string | null) {
  const raw = month || createdAt || "Unrecorded";
  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
    }).format(parsed);
  }

  return raw;
}

function monthSortValue(month: string) {
  const parsed = new Date(month);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}
