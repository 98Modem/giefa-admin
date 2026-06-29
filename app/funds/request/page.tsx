import { createEmergencyRequest } from "@/app/actions/giefa";
import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  dateLabel,
  getCurrentMember,
  getEmergencyRequests,
  getMemberLookup,
  money,
} from "@/app/lib/giefa/liveData";

export default async function RequestFundsPage() {
  const [member, requests, members] = await Promise.all([
    getCurrentMember(),
    getEmergencyRequests(),
    getMemberLookup(),
  ]);

  const myRequests = member
    ? requests.filter((request) => request.member_id === member.id)
    : [];

  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Funds"
        title="Request Emergency Funds"
        description="Create an emergency fund request. The request is submitted as pending and routed through the treasurer approval workflow."
        metrics={[
          { label: "My Open Requests", value: String(myRequests.filter((request) => request.status === "pending").length), detail: "Awaiting review" },
          { label: "My Approved Requests", value: String(myRequests.filter((request) => request.status === "approved").length), detail: "Approved history" },
          { label: "Latest Request", value: myRequests[0] ? money(myRequests[0].amount) : "None", detail: myRequests[0] ? dateLabel(myRequests[0].created_at) : "No request submitted" },
          { label: "Review Owner", value: "Treasurer", detail: "Approval workflow" },
        ]}
        sections={[
          {
            title: "Request Rules",
            body: "Only approved members can create emergency fund requests. The treasurer reviews pending requests.",
            items: ["Amount is required", "Status starts as pending", "Approval is performed through RPC"],
          },
        ]}
        table={{
          columns: ["Member", "Amount", "Status", "Submitted"],
          rows: myRequests.map((request) => [
            members[request.member_id]?.email ?? "Me",
            money(request.amount),
            request.status ?? "pending",
            dateLabel(request.created_at),
          ]),
          empty: "You have not submitted any emergency fund requests yet.",
        }}
      />

      <section className="mx-auto max-w-7xl rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">
          New Emergency Request
        </h2>
        <form action={createEmergencyRequest} className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Amount</span>
            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              required
              placeholder="Enter amount in UGX"
              className="mt-1 h-11 w-full rounded-lg border px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
          <button
            type="submit"
            className="self-end rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white hover:bg-brand-600"
          >
            Submit Request
          </button>
        </form>
      </section>
    </div>
  );
}
