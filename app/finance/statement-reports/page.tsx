import {
  dateLabel,
  getBankStatementImports,
  getBankStatementTransactions,
  getCurrentMember,
  getFinanceMonthlyReports,
  getFinanceInterestAllocations,
  getFinanceReportEditRequests,
  getMemberLookup,
  getDepositSubmissions,
  memberName,
  money,
} from "@/app/lib/giefa/liveData";
import { supabaseServer } from "@/app/lib/supabase/server";
import {
  approveFinanceReportEdit,
  requestFinanceReportEdit,
} from "@/app/actions/financeReports";
import { ReportEditDialog } from "./ReportEditDialog";
import { StatementReportForm } from "./StatementReportForm";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function statusTone(status: string | null | undefined) {
  if (status === "exact") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  if (status === "possible") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  }

  return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
}

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(status)}`}>
      {status ?? "unmatched"}
    </span>
  );
}

export default async function StatementReportsPage() {
  const supabase = await supabaseServer();
  const [imports, transactions, reports, members, submissions, currentMember] = await Promise.all([
    getBankStatementImports(),
    getBankStatementTransactions(),
    getFinanceMonthlyReports(),
    getMemberLookup(),
    getDepositSubmissions(),
    getCurrentMember(),
  ]);
  const latestImport = imports[0];
  const latestTransactions = latestImport
    ? transactions.filter((row) => row.statement_import_id === latestImport.id)
    : [];
  const latestReport = reports[0];
  const [latestAllocations, editRequests] = await Promise.all([
    getFinanceInterestAllocations(latestReport?.id),
    getFinanceReportEditRequests(),
  ]);
  const statementUrls = new Map<string, string>();
  const approvedSubmissions = submissions.filter((row) => row.status === "approved");
  const pendingSubmissions = latestReport
    ? submissions.filter(
        (row) =>
          row.contribution_month === latestReport.reporting_month &&
          (row.status === "submitted" || row.status === "needs_review")
      )
    : [];
  const submissionLookup = new Map(approvedSubmissions.map((submission) => [submission.id, submission]));
  const canRequestEdit =
    currentMember?.role === "treasurer" ||
    currentMember?.role === "chairman" ||
    currentMember?.role === "admin";
  const canApproveEdit = currentMember?.role === "chairman" || currentMember?.role === "admin";

  await Promise.all(
    imports.map(async (statementImport) => {
      if (!statementImport.statement_file_url) return;
      const { data } = await supabase.storage
        .from("bank-statements")
        .createSignedUrl(statementImport.statement_file_url, 60 * 10);

      if (data?.signedUrl) {
        statementUrls.set(statementImport.id, data.signedUrl);
      }
    })
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="border-b border-gray-200 pb-5 dark:border-white/20">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
          Finance
        </p>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Statement Reports
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-200">
          Upload the monthly bank statement, match bank credits against approved
          member deposits, and prepare the month-end report for leadership review.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <StatementReportForm defaultMonth={currentMonth()} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {[
            ["Latest report", latestReport?.reporting_month ?? "No report", "Reporting month"],
            ["Approved deposits", money(latestReport?.approved_member_deposits), "Member submissions posted"],
            ["Interest / variance", money(latestReport?.calculated_interest_amount ?? latestReport?.unmatched_deposits), "Daily weighted allocation base"],
            ["Exceptions", String(latestReport?.exception_count ?? 0), "Needs finance review"],
          ].map(([label, value, detail]) => (
            <div
              key={label}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-white/10"
            >
              <p className="text-sm text-gray-500 dark:text-gray-300">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                {value}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                {detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/15 dark:bg-white/10">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-white/15">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Monthly Report History
          </h2>
        </div>
        {reports.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-gray-200">
            No monthly finance reports have been generated yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/5 dark:text-gray-200">
                <tr>
                  {["Month", "Statement Movement", "Approved Deposits", "Interest / Variance", "Closing", "File", "Status", "Edit Control"].map((column) => (
                    <th key={column} className="px-5 py-3 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {reports.map((report) => {
                  const statementImport = imports.find((row) => row.id === report.statement_import_id);
                  const signedUrl = statementImport ? statementUrls.get(statementImport.id) : null;
                  const hasOpenEditRequest = editRequests.some(
                    (request) =>
                      request.report_id === report.id &&
                      ["requested", "approved"].includes(request.status ?? "")
                  );

                  return (
                    <tr key={report.id}>
                      <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">
                        {report.reporting_month}
                      </td>
                      <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                        {money(report.total_deposits)}
                      </td>
                      <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                        {money(report.approved_member_deposits)}
                      </td>
                      <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                        {money(report.calculated_interest_amount ?? report.unmatched_deposits)}
                        {report.variance_status === "deposit_exceeds_statement" && (
                          <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-200">
                            Approved deposits exceed statement movement
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                        {money(report.closing_balance)}
                      </td>
                      <td className="px-5 py-4">
                        {signedUrl ? (
                          <a
                            href={signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-brand-600 hover:underline dark:text-brand-300"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-300">No file</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                        {report.status ?? "draft"}
                      </td>
                      <td className="min-w-72 px-5 py-4">
                        {canRequestEdit &&
                          !hasOpenEditRequest &&
                          !["edit_requested", "edit_approved"].includes(report.status ?? "") && (
                          <form action={requestFinanceReportEdit} className="grid gap-2">
                            <input type="hidden" name="report_id" value={report.id} />
                            <input
                              name="reason"
                              placeholder="Why edit this report?"
                              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 dark:border-white/15 dark:bg-white/10 dark:text-white"
                            />
                            <button className="rounded-md border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-300/30 dark:text-brand-100 dark:hover:bg-brand-500/10">
                              Request edit
                            </button>
                          </form>
                        )}
                        {editRequests
                          .filter((request) => request.report_id === report.id && request.status === "requested")
                          .map((request) =>
                            canApproveEdit ? (
                              <form key={request.id} action={approveFinanceReportEdit} className="grid gap-2">
                                <input type="hidden" name="request_id" value={request.id} />
                                <input
                                  name="chairman_note"
                                  placeholder="Chairman note"
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
                              <span key={request.id} className="text-xs font-semibold text-amber-600 dark:text-amber-200">
                                Edit awaiting chairman approval
                              </span>
                            )
                          )}
                        {canRequestEdit &&
                          editRequests
                            .filter((request) => request.report_id === report.id && request.status === "approved")
                            .map((request) => (
                              <ReportEditDialog
                                key={request.id}
                                requestId={request.id}
                                reportId={report.id}
                                reportingMonth={report.reporting_month}
                                openingBalance={report.opening_balance}
                                closingBalance={report.closing_balance}
                                statementMovement={report.total_deposits}
                                approvedDeposits={report.approved_member_deposits}
                                interestAmount={report.manual_interest_amount ?? report.calculated_interest_amount ?? report.unmatched_deposits}
                                notes={report.notes}
                              />
                            ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/15 dark:bg-white/10">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-white/15">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Daily Weighted Interest Allocation
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            Interest is distributed by each member&apos;s weighted investment balance for the reporting month.
          </p>
        </div>
        {latestAllocations.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-gray-200">
            No allocation rows yet. Generate a report after running the daily weighted interest SQL script.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/5 dark:text-gray-200">
                <tr>
                  {["Member", "Opening Base", "Month Deposits", "Weight", "Interest"].map((column) => (
                    <th key={column} className="px-5 py-3 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {latestAllocations.map((allocation) => (
                  <tr key={allocation.id}>
                    <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">
                      {memberName(members[allocation.member_id])}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                      {money(allocation.opening_investment_balance)}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                      {money(allocation.month_investment_deposits)}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                      {`${((allocation.allocation_weight ?? 0) * 100).toFixed(2)}%`}
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">
                      {money(allocation.interest_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/15 dark:bg-white/10">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-white/15">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Pending Member Proof For Latest Month
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            Pending submissions stay visible in the report but do not earn interest until finance approves them.
          </p>
        </div>
        {pendingSubmissions.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-gray-200">
            No pending member deposit proofs for the latest report month.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/5 dark:text-gray-200">
                <tr>
                  {["Member", "Amount", "Deposit Date", "Reference", "Status"].map((column) => (
                    <th key={column} className="px-5 py-3 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {pendingSubmissions.map((submission) => (
                  <tr key={submission.id}>
                    <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">
                      {memberName(members[submission.member_id])}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                      {money(submission.amount)}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                      {submission.deposit_date ? dateLabel(submission.deposit_date) : "No date"}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                      {submission.bank_reference ?? "No reference"}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                      {submission.status ?? "submitted"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/15 dark:bg-white/10">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-white/15">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Detailed Transaction Matching
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            {latestImport
              ? `${latestImport.reporting_month} import from ${dateLabel(latestImport.created_at)}`
              : "Upload a statement to see transaction matching results."}
          </p>
        </div>
        {latestTransactions.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-gray-200">
            No individual bank-credit transactions were parsed from the latest statement. This is expected for SBG valuation statements, which summarize portfolio performance instead of listing every member deposit.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/5 dark:text-gray-200">
                <tr>
                  {["Date", "Narration", "Credit", "Matched Member", "Reference", "Match"].map((column) => (
                    <th key={column} className="px-5 py-3 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {latestTransactions.map((transaction) => {
                  const submission = transaction.matched_submission_id
                    ? submissionLookup.get(transaction.matched_submission_id)
                    : null;

                  return (
                    <tr key={transaction.id}>
                      <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                        {transaction.transaction_date
                          ? dateLabel(transaction.transaction_date)
                          : "No date"}
                      </td>
                      <td className="max-w-md px-5 py-4 text-gray-700 dark:text-gray-100">
                        {transaction.description ?? "No narration"}
                      </td>
                      <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">
                        {money(transaction.credit)}
                      </td>
                      <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                        {submission
                          ? memberName(members[submission.member_id])
                          : "Needs review"}
                      </td>
                      <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                        {transaction.reference ?? "No reference"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill status={transaction.match_status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
