import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  dateLabel,
  getCurrentMember,
  getEmergencyRequests,
  money,
} from "@/app/lib/giefa/liveData";

export default async function MyRequestsPage() {
  const [member, requests] = await Promise.all([
    getCurrentMember(),
    getEmergencyRequests(),
  ]);
  const myRequests = member
    ? requests.filter((request) => request.member_id === member.id)
    : [];

  return (
    <FeaturePage
      eyebrow="Funds"
      title="My Requests"
      description="Live history of your emergency fund requests from Supabase."
      primaryAction={{ label: "New Request", href: "/funds/request" }}
      metrics={[
        { label: "Total Requests", value: String(myRequests.length), detail: "All time" },
        { label: "Pending", value: String(myRequests.filter((request) => request.status === "pending").length), detail: "Awaiting treasurer" },
        { label: "Approved", value: String(myRequests.filter((request) => request.status === "approved").length), detail: "Approved requests" },
        { label: "Rejected", value: String(myRequests.filter((request) => request.status === "rejected").length), detail: "Rejected requests" },
      ]}
      table={{
        columns: ["Amount", "Status", "Submitted", "Approved At"],
        rows: myRequests.map((request) => [
          money(request.amount),
          request.status ?? "pending",
          dateLabel(request.created_at),
          dateLabel(request.approved_at),
        ]),
        empty: "You do not have any emergency fund requests yet.",
      }}
    />
  );
}
