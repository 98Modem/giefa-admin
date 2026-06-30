import { FeaturePage } from "@/app/components/feature/FeaturePage";
import { approveFinanceReportEdit } from "@/app/actions/financeReports";
import {
  dateLabel,
  getFinanceMonthlyReports,
  getFinanceReportEditRequests,
  getMemberLookup,
  memberName,
  money,
  sumBy,
} from "@/app/lib/giefa/liveData";

export default async function ChairmanFinanceReportsPage() {
  const [reports, editRequests, members] = await Promise.all([
    getFinanceMonthlyReports(),
    getFinanceReportEditRequests(),
    getMemberLookup(),
  ]);
  const readyForReview = reports.filter((report) => report.status === "draft");
  const pendingEditRequests = editRequests.filter(
    (request) => request.status === "requested"
  );

  return (
    <FeaturePage
      eyebrow="Chairman"
      title="Finance Reports"
      description="Review treasurer-prepared monthly statement reports, matching exceptions, and finance close notes before association meetings."
      metrics={[
        { label: "Ready for Review", value: String(readyForReview.length), detail: "Draft reports" },
        { label: "Report Archive", value: String(reports.length), detail: "Generated months" },
        { label: "Edit Requests", value: String(pendingEditRequests.length), detail: "Needs leadership decision" },
        { label: "Approved Value", value: money(sumBy(reports, (report) => report.approved_member_deposits)), detail: "Posted member deposits" },
      ]}
      sections={[
        {
          title: "Leadership Review",
          body: "Chairman access focuses on oversight, finance accountability, edit approvals, and unresolved statement variances.",
          items: ["Read monthly summaries", "Approve report edits", "Compare closing balances"],
        },
        {
          title: "Meeting Preparation",
          body: "Reports should support executive committee discussions and member accountability.",
          items: ["Meeting-ready summaries", "Action items", "Historical comparison"],
        },
      ]}
      table={{
        columns: ["Period", "Statement Movement", "Interest / Variance", "Members", "Exceptions", "Status", "Leadership Action"],
        rows: reports.map((report) => {
          const reportRequests = editRequests.filter(
            (request) => request.report_id === report.id
          );
          const pendingRequest = reportRequests.find(
            (request) => request.status === "requested"
          );

          return [
            report.reporting_month,
            money(report.total_deposits),
            money(report.calculated_interest_amount ?? report.unmatched_deposits),
            String(report.member_count ?? 0),
            String(report.exception_count ?? 0),
            report.status ?? "draft",
            pendingRequest ? (
              <form
                key={pendingRequest.id}
                action={approveFinanceReportEdit}
                className="grid min-w-72 gap-2"
              >
                <input type="hidden" name="request_id" value={pendingRequest.id} />
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-300/25 dark:bg-amber-500/10 dark:text-amber-100">
                  <p className="font-semibold">
                    Requested by {memberName(members[pendingRequest.requested_by ?? ""])}
                  </p>
                  <p className="mt-1">{pendingRequest.reason || "No reason provided."}</p>
                  <p className="mt-1 opacity-80">{dateLabel(pendingRequest.created_at)}</p>
                </div>
                <input
                  name="chairman_note"
                  placeholder="Decision note"
                  className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 dark:border-white/15 dark:bg-white/10 dark:text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    name="decision"
                    value="approve"
                    className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Approve edit
                  </button>
                  <button
                    name="decision"
                    value="reject"
                    className="rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
                  >
                    Reject
                  </button>
                </div>
              </form>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-300">
                No pending edit
              </span>
            ),
          ];
        }),
        empty: "No finance reports have been prepared yet.",
      }}
    />
  );
}
