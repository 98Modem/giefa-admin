import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  dateLabel,
  getEmergencyRequests,
  getMemberLookup,
  memberName,
  money,
} from "@/app/lib/giefa/liveData";

export default async function ApprovedFundRequestsPage() {
  const [requests, members] = await Promise.all([
    getEmergencyRequests("approved"),
    getMemberLookup(),
  ]);

  return (
    <FeaturePage
      eyebrow="Treasurer"
      title="Approved Requests"
      description="Live list of approved emergency fund requests and disbursement exposure."
      metrics={[
        { label: "Approved Requests", value: String(requests.length), detail: "All visible approved records" },
        { label: "Approved Amount", value: money(requests.reduce((total, request) => total + Number(request.amount ?? 0), 0)), detail: "Total approved" },
        { label: "Latest Approval", value: requests[0] ? dateLabel(requests[0].approved_at ?? requests[0].created_at) : "None", detail: "Most recent approval" },
        { label: "Data Source", value: "Supabase", detail: "emergency_requests" },
      ]}
      table={{
        columns: ["Member", "Amount", "Submitted", "Approved At"],
        rows: requests.map((request) => [
          memberName(members[request.member_id]),
          money(request.amount),
          dateLabel(request.created_at),
          dateLabel(request.approved_at),
        ]),
        empty: "There are no approved emergency requests yet.",
      }}
    />
  );
}
