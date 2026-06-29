import {
  approveEmergencyRequest,
  rejectEmergencyRequest,
} from "@/app/actions/giefa";
import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  dateLabel,
  getEmergencyRequests,
  getMemberLookup,
  memberName,
  money,
} from "@/app/lib/giefa/liveData";

export default async function PendingFundRequestsPage() {
  const [requests, members] = await Promise.all([
    getEmergencyRequests("pending"),
    getMemberLookup(),
  ]);

  return (
    <FeaturePage
      eyebrow="Treasurer"
      title="Pending Fund Requests"
      description="Live emergency request queue. Approve/reject actions call Supabase RPC functions."
      metrics={[
        { label: "Pending Queue", value: String(requests.length), detail: "Awaiting treasurer review" },
        { label: "Pending Amount", value: money(requests.reduce((total, request) => total + Number(request.amount ?? 0), 0)), detail: "Requested total" },
        { label: "Oldest Request", value: requests.at(-1) ? dateLabel(requests.at(-1)?.created_at) : "None", detail: "Queue age" },
        { label: "Decision Path", value: "RPC", detail: "approve/reject functions" },
      ]}
      table={{
        columns: ["Member", "Amount", "Submitted", "Actions"],
        rows: requests.map((request) => [
          memberName(members[request.member_id]),
          money(request.amount),
          dateLabel(request.created_at),
          <div key={request.id} className="flex flex-wrap gap-2">
            <form action={approveEmergencyRequest}>
              <input type="hidden" name="request_id" value={request.id} />
              <button className="rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white">
                Approve
              </button>
            </form>
            <form action={rejectEmergencyRequest}>
              <input type="hidden" name="request_id" value={request.id} />
              <button className="rounded-md bg-error-600 px-3 py-1.5 text-xs font-medium text-white">
                Reject
              </button>
            </form>
          </div>,
        ]),
        empty: "There are no pending emergency fund requests.",
      }}
    />
  );
}
