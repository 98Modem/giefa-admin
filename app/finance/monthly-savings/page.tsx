import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  dateLabel,
  getMemberLookup,
  getMonthlyContributions,
  memberName,
  money,
} from "@/app/lib/giefa/liveData";

export default async function MonthlySavingsPage() {
  const [contributions, members] = await Promise.all([
    getMonthlyContributions(),
    getMemberLookup(),
  ]);

  return (
    <FeaturePage
      eyebrow="Finance"
      title="Monthly Savings"
      description="Live contribution ledger from monthly_contributions."
      metrics={[
        { label: "Total Collected", value: money(contributions.reduce((total, row) => total + Number(row.amount ?? 0), 0)), detail: "Visible rows" },
        { label: "Emergency Allocation", value: money(contributions.reduce((total, row) => total + Number(row.emergency_amount ?? 0), 0)), detail: "Emergency fund portion" },
        { label: "Investment Allocation", value: money(contributions.reduce((total, row) => total + Number(row.investment_amount ?? 0), 0)), detail: "Investment fund portion" },
        { label: "Rows", value: String(contributions.length), detail: "monthly_contributions" },
      ]}
      table={{
        columns: ["Member", "Month", "Amount", "Emergency", "Investment", "Created"],
        rows: contributions.map((row) => [
          memberName(members[row.member_id]),
          row.month ?? "No month",
          money(row.amount),
          money(row.emergency_amount),
          money(row.investment_amount),
          dateLabel(row.created_at),
        ]),
        empty: "No monthly contribution records are visible.",
      }}
    />
  );
}
