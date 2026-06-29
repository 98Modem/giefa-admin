import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  dateLabel,
  getCurrentMember,
  getShares,
  money,
} from "@/app/lib/giefa/liveData";

export default async function InvestmentFundPage() {
  const [member, shares] = await Promise.all([getCurrentMember(), getShares()]);
  const rows = member ? shares.filter((share) => share.member_id === member.id) : [];
  const current = rows[0];

  return (
    <FeaturePage
      eyebrow="My Account"
      title="Investment Fund"
      description="Live investment/share position from the shares table."
      metrics={[
        { label: "Total Amount", value: money(current?.total_amount), detail: "Investment value" },
        { label: "Total Shares", value: Number(current?.total_shares ?? 0).toLocaleString(), detail: "Recorded shares" },
        { label: "Records", value: String(rows.length), detail: "Visible share records" },
        { label: "Last Record", value: current ? dateLabel(current.created_at) : "None", detail: "shares" },
      ]}
      table={{
        columns: ["Total Amount", "Total Shares", "Created"],
        rows: rows.map((share) => [
          money(share.total_amount),
          Number(share.total_shares ?? 0).toLocaleString(),
          dateLabel(share.created_at),
        ]),
        empty: "No investment share records are visible for your account.",
      }}
    />
  );
}
