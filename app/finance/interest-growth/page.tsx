import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  getEmergencyFunds,
  getMonthlyContributions,
  getShares,
  money,
} from "@/app/lib/giefa/liveData";

export default async function InterestGrowthPage() {
  const [contributions, emergencyFunds, shares] = await Promise.all([
    getMonthlyContributions(),
    getEmergencyFunds(),
    getShares(),
  ]);
  const pooledDepositBase = contributions.reduce(
    (total, row) => total + Number(row.amount ?? 0),
    0
  );
  const emergencyAvailable = emergencyFunds.reduce(
    (total, row) => total + Number(row.available ?? 0),
    0
  );
  const shareValue = shares.reduce(
    (total, row) => total + Number(row.total_amount ?? 0),
    0
  );
  const visiblePoolValue = shareValue + emergencyAvailable;
  const estimatedGrowth = Math.max(visiblePoolValue - pooledDepositBase, 0);

  return (
    <FeaturePage
      eyebrow="Finance"
      title="Interest Growth"
      description="Live growth view for the combined GIEFA pool. Interest reports use investment and emergency balances together because both sit in the same earning fund."
      metrics={[
        { label: "Pooled Deposit Base", value: money(pooledDepositBase), detail: "Investment + emergency contributions" },
        { label: "Visible Pool Value", value: money(visiblePoolValue), detail: "Shares + available emergency funds" },
        { label: "Estimated Growth", value: money(estimatedGrowth), detail: "Visible value minus deposit base" },
        { label: "Share Records", value: String(shares.length), detail: "Visible rows" },
      ]}
      table={{
        columns: ["Metric", "Value", "Source"],
        rows: [
          ["Pooled deposit base", money(pooledDepositBase), "monthly_contributions.amount"],
          ["Investment share value", money(shareValue), "shares.total_amount"],
          ["Emergency fund available", money(emergencyAvailable), "emergency_funds.available"],
          ["Estimated growth", money(estimatedGrowth), "Derived"],
        ],
      }}
    />
  );
}
