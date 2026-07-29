import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  getCurrentMember,
  getFinanceInterestAllocations,
  getMonthlyContributions,
  money,
} from "@/app/lib/giefa/liveData";

export default async function InterestEarnedPage() {
  const [member, contributions, allocations] = await Promise.all([
    getCurrentMember(),
    getMonthlyContributions(),
    getFinanceInterestAllocations(),
  ]);
  const rows = member
    ? contributions.filter((contribution) => contribution.member_id === member.id)
    : [];
  const allocationRows = member
    ? allocations.filter((allocation) => allocation.member_id === member.id)
    : [];
  const totalPooledDeposits = rows.reduce(
    (total, row) => total + Number(row.amount ?? 0),
    0
  );
  const postedInterest = allocationRows.reduce(
    (total, row) => total + Number(row.interest_amount ?? 0),
    0
  );

  return (
    <FeaturePage
      eyebrow="My Account"
      title="Interest Earned"
      description="Interest is allocated from monthly finance reports using each member's daily weighted pooled balance, including investment and emergency funds."
      metrics={[
        { label: "Pooled Deposit Base", value: money(totalPooledDeposits), detail: "Investment + emergency contributions" },
        { label: "Posted Interest", value: money(postedInterest), detail: "Daily weighted allocations" },
        { label: "Contribution Rows", value: String(rows.length), detail: "monthly_contributions" },
        { label: "Allocation Rows", value: String(allocationRows.length), detail: "finance_interest_allocations" },
      ]}
      table={{
        columns: ["Month", "Opening Pool Base", "Month Deposits", "Weight", "Interest"],
        rows: allocationRows.map((row) => [
          row.reporting_month,
          money(row.opening_investment_balance),
          money(row.month_investment_deposits),
          `${((row.allocation_weight ?? 0) * 100).toFixed(2)}%`,
          money(row.interest_amount),
        ]),
        empty: "No interest allocations have been posted for your account yet.",
      }}
    />
  );
}
