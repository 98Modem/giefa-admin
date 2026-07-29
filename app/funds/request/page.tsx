import { createEmergencyRequest } from "@/app/actions/giefa";
import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  dateLabel,
  getCurrentMember,
  getEmergencyFunds,
  getEmergencyRequests,
  getMemberLookup,
  money,
} from "@/app/lib/giefa/liveData";

const EMERGENCY_MINIMUM_AVAILABLE = 180_000;
const EMERGENCY_REQUEST_CAP_RATE = 0.5;
const EMERGENCY_APPROVED_REQUESTS_PER_CYCLE = 2;

export default async function RequestFundsPage() {
  const [member, requests, members, emergencyFunds] = await Promise.all([
    getCurrentMember(),
    getEmergencyRequests(),
    getMemberLookup(),
    getEmergencyFunds(),
  ]);

  const myRequests = member
    ? requests.filter((request) => request.member_id === member.id)
    : [];
  const myEmergencyFund = member
    ? emergencyFunds.find((fund) => fund.member_id === member.id)
    : null;
  const availableEmergencyFund = Number(myEmergencyFund?.available ?? 0);
  const approvedCycleCount = Number(myEmergencyFund?.request_cycle_count ?? 0);
  const remainingCycleRequests = Math.max(
    0,
    EMERGENCY_APPROVED_REQUESTS_PER_CYCLE - approvedCycleCount
  );
  const maxRequestAmount = Math.floor(
    availableEmergencyFund * EMERGENCY_REQUEST_CAP_RATE
  );
  const hasPendingRequest = myRequests.some(
    (request) => request.status === "pending"
  );
  const canRequest =
    availableEmergencyFund >= EMERGENCY_MINIMUM_AVAILABLE &&
    remainingCycleRequests > 0 &&
    !hasPendingRequest;
  const blockedReason = hasPendingRequest
    ? "You already have one emergency request waiting for treasurer review."
    : availableEmergencyFund < EMERGENCY_MINIMUM_AVAILABLE
      ? `Emergency requests open when your available emergency balance reaches ${money(EMERGENCY_MINIMUM_AVAILABLE)}.`
      : remainingCycleRequests <= 0
        ? "You have used two approved requests in this cycle. Refill your emergency fund before requesting again."
        : "";

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
            body: "Emergency fund access is based on your available personal reserve and the current request cycle.",
            items: [
              `Minimum available emergency balance: ${money(EMERGENCY_MINIMUM_AVAILABLE)}`,
              "Each request can be up to 50% of the available emergency balance",
              "Two approved requests are allowed before a refill is required",
            ],
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

      <section className="mx-auto max-w-7xl rounded-lg border border-[rgb(var(--theme-border))] bg-white p-5 shadow-sm dark:bg-white/10">
        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
              Emergency Access
            </p>
            <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
              New emergency request
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-white/70">
              Treasurer approval is required. Your emergency ledger changes only
              after the request is approved.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[rgb(var(--theme-border))] bg-gray-50 p-4 dark:bg-black/10">
              <p className="text-xs text-gray-500 dark:text-white/60">Available</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {money(availableEmergencyFund)}
              </p>
            </div>
            <div className="rounded-lg border border-[rgb(var(--theme-border))] bg-gray-50 p-4 dark:bg-black/10">
              <p className="text-xs text-gray-500 dark:text-white/60">Request cap</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {money(maxRequestAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-[rgb(var(--theme-border))] bg-gray-50 p-4 dark:bg-black/10">
              <p className="text-xs text-gray-500 dark:text-white/60">Requests left</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {remainingCycleRequests} / {EMERGENCY_APPROVED_REQUESTS_PER_CYCLE}
              </p>
            </div>
          </div>
        </div>

        {blockedReason ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100">
            {blockedReason}
          </div>
        ) : null}

        <form action={createEmergencyRequest} className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-white">
              Amount
            </span>
            <input
              name="amount"
              type="number"
              min="1"
              max={maxRequestAmount || undefined}
              step="1"
              required
              disabled={!canRequest}
              placeholder={
                canRequest
                  ? `Up to ${money(maxRequestAmount)}`
                  : "Emergency request unavailable"
              }
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/10 dark:text-white"
            />
          </label>
          <button
            type="submit"
            disabled={!canRequest}
            className="self-end rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Submit Request
          </button>
        </form>
      </section>
    </div>
  );
}
