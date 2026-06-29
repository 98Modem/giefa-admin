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
  const totalInvestment = rows.reduce(
    (total, row) => total + Number(row.investment_amount ?? 0),
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
      description="Interest is allocated from monthly finance reports using daily weighted investment balances, so deposits made on different dates earn fairly."
      metrics={[
        { label: "Investment Base", value: money(totalInvestment), detail: "Visible investment contributions" },
        { label: "Posted Interest", value: money(postedInterest), detail: "Daily weighted allocations" },
        { label: "Contribution Rows", value: String(rows.length), detail: "monthly_contributions" },
        { label: "Allocation Rows", value: String(allocationRows.length), detail: "finance_interest_allocations" },
      ]}
      table={{
        columns: ["Month", "Opening Base", "Month Deposits", "Weight", "Interest"],
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
