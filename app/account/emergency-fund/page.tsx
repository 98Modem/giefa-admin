import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  dateLabel,
  getCurrentMember,
  getEmergencyFunds,
  money,
} from "@/app/lib/giefa/liveData";

export default async function EmergencyFundPage() {
  const [member, funds] = await Promise.all([
    getCurrentMember(),
    getEmergencyFunds(),
  ]);
  const rows = member ? funds.filter((fund) => fund.member_id === member.id) : [];
  const current = rows[0];

  return (
    <FeaturePage
      eyebrow="My Account"
      title="Emergency Fund"
      description="Live emergency fund balance and withdrawal position from Supabase."
      metrics={[
        { label: "Available", value: money(current?.available), detail: "Current visible balance" },
        { label: "Contributed", value: money(current?.total_contributed), detail: "Lifetime contribution" },
        { label: "Withdrawn", value: money(current?.total_withdrawn), detail: "Lifetime withdrawals" },
        { label: "Last Record", value: current ? dateLabel(current.created_at) : "None", detail: "emergency_funds" },
      ]}
      primaryAction={{ label: "Request Emergency Funds", href: "/funds/request" }}
      table={{
        columns: ["Total Contributed", "Total Withdrawn", "Available", "Created"],
        rows: rows.map((fund) => [
          money(fund.total_contributed),
          money(fund.total_withdrawn),
          money(fund.available),
          dateLabel(fund.created_at),
        ]),
        empty: "No emergency fund balance is visible for your account.",
      }}
    />
  );
}
