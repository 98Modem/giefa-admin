import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  getMonthlyContributions,
  getShares,
  money,
} from "@/app/lib/giefa/liveData";

export default async function InterestGrowthPage() {
  const [contributions, shares] = await Promise.all([
    getMonthlyContributions(),
    getShares(),
  ]);
  const investmentBase = contributions.reduce(
    (total, row) => total + Number(row.investment_amount ?? 0),
    0
  );
  const shareValue = shares.reduce(
    (total, row) => total + Number(row.total_amount ?? 0),
    0
  );
  const estimatedGrowth = Math.max(shareValue - investmentBase, 0);

  return (
    <FeaturePage
      eyebrow="Finance"
      title="Interest Growth"
      description="Live growth view derived from investment contribution and shares records."
      metrics={[
        { label: "Investment Base", value: money(investmentBase), detail: "monthly_contributions" },
        { label: "Current Share Value", value: money(shareValue), detail: "shares" },
        { label: "Estimated Growth", value: money(estimatedGrowth), detail: "Share value minus base" },
        { label: "Share Records", value: String(shares.length), detail: "Visible rows" },
      ]}
      table={{
        columns: ["Metric", "Value", "Source"],
        rows: [
          ["Investment base", money(investmentBase), "monthly_contributions.investment_amount"],
          ["Share value", money(shareValue), "shares.total_amount"],
          ["Estimated growth", money(estimatedGrowth), "Derived"],
        ],
      }}
    />
  );
}
