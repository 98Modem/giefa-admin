import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  dateLabel,
  getCurrentMember,
  getMonthlyContributions,
  money,
} from "@/app/lib/giefa/liveData";

export default async function InterestEarnedPage() {
  const [member, contributions] = await Promise.all([
    getCurrentMember(),
    getMonthlyContributions(),
  ]);
  const rows = member
    ? contributions.filter((contribution) => contribution.member_id === member.id)
    : [];
  const totalInvestment = rows.reduce(
    (total, row) => total + Number(row.investment_amount ?? 0),
    0
  );
  const estimatedInterest = totalInvestment * 0.08;

  return (
    <FeaturePage
      eyebrow="My Account"
      title="Interest Earned"
      description="Interest is derived from visible investment contribution records. Final calculation rules should live in a Supabase RPC once approved."
      metrics={[
        { label: "Investment Base", value: money(totalInvestment), detail: "Visible investment contributions" },
        { label: "Estimated Interest", value: money(estimatedInterest), detail: "Illustrative 8% estimate" },
        { label: "Contribution Rows", value: String(rows.length), detail: "monthly_contributions" },
        { label: "Calculation", value: "Pending RPC", detail: "Use DB function for final production logic" },
      ]}
      table={{
        columns: ["Month", "Investment Amount", "Emergency Amount", "Created"],
        rows: rows.map((row) => [
          row.month ?? "No month",
          money(row.investment_amount),
          money(row.emergency_amount),
          dateLabel(row.created_at),
        ]),
        empty: "No contribution records are visible for your account.",
      }}
    />
  );
}
