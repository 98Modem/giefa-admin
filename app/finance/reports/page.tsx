import Link from "next/link";
import { PrintReportButton } from "@/app/components/feature/PrintReportButton";
import {
  dateLabel,
  getBankStatementTransactions,
  getCurrentMember,
  getDepositSubmissions,
  getFinanceInterestAllocations,
  getFinanceMonthlyReports,
  getMemberLookup,
  memberName,
  money,
  sumBy,
} from "@/app/lib/giefa/liveData";

function monthLabel(value: string | null | undefined) {
  if (!value) return "No reporting month";
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function percent(value: number) {
  if (!Number.isFinite(value)) return "0.00%";
  return `${value.toFixed(2)}%`;
}

function statusTone(value: string | null | undefined) {
  if (value === "final" || value === "approved") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-100";
  }

  if (value === "edit_requested" || value === "edit_approved") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-100";
  }

  return "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100";
}

export default async function FinancialReportsPage() {
  const [reports, members, submissions, currentMember] = await Promise.all([
    getFinanceMonthlyReports(),
    getMemberLookup(),
    getDepositSubmissions(),
    getCurrentMember(),
  ]);

  const report = reports[0];
  const [allocations, transactions] = await Promise.all([
    getFinanceInterestAllocations(report?.id),
    getBankStatementTransactions(report?.statement_import_id ?? undefined),
  ]);

  const activeMembers = Object.values(members).filter(
    (member) => member.status === "approved"
  );
  const approvedMonthSubmissions = report
    ? submissions.filter(
        (submission) =>
          submission.status === "approved" &&
          submission.contribution_month === report.reporting_month
      )
    : [];
  const pendingMonthSubmissions = report
    ? submissions.filter(
        (submission) =>
          submission.contribution_month === report.reporting_month &&
          (submission.status === "submitted" ||
            submission.status === "needs_review")
      )
    : [];

  const contributorIds = new Set(
    approvedMonthSubmissions.map((submission) => submission.member_id)
  );
  const openingBalance = Number(report?.opening_balance ?? 0);
  const closingBalance = Number(report?.closing_balance ?? 0);
  const approvedDeposits = Number(report?.approved_member_deposits ?? 0);
  const statementMovement = Number(report?.total_deposits ?? 0);
  const interestAmount = Number(
    report?.calculated_interest_amount ??
      report?.manual_interest_amount ??
      Math.max(statementMovement - approvedDeposits, 0)
  );
  const periodicReturn = closingBalance - openingBalance;
  const growthRate = openingBalance > 0 ? (interestAmount / openingBalance) * 100 : 0;
  const participationRate =
    activeMembers.length > 0 ? (contributorIds.size / activeMembers.length) * 100 : 0;
  const exceptionCount =
    Number(report?.exception_count ?? 0) + pendingMonthSubmissions.length;
  const preparedBy = currentMember
    ? memberName(currentMember)
    : memberName(members[report?.prepared_by ?? ""]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 print:max-w-none print:bg-white print:text-gray-950">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-white/20 print:hidden lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
            Finance
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Financial Reports
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-200">
            Review the monthly treasurer report with member deposits, SBG
            statement performance, daily weighted interest allocation, and
            leadership-ready notes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/finance/statement-reports"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
          >
            Statement Reports
          </Link>
          <PrintReportButton
            reports={reports.map((item) => ({
              month: item.reporting_month,
              label: monthLabel(item.reporting_month),
            }))}
          />
        </div>
      </div>

      {!report ? (
        <section className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-white/15 dark:bg-white/10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            No monthly report yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-200">
            Upload a bank statement and generate the first monthly close before
            preparing the finance report.
          </p>
          <Link
            href="/finance/statement-reports"
            className="mt-5 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Create report
          </Link>
        </section>
      ) : (
        <article className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-white/10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="rounded-lg border border-brand-100 bg-brand-50/80 p-5 dark:border-brand-300/20 dark:bg-brand-500/10 print:border-gray-200 print:bg-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200 print:text-gray-600">
                  Graduate Investment and Emergency Fund Association
                </p>
                <h2 className="mt-2 text-2xl font-bold text-gray-950 dark:text-white print:text-3xl">
                  Monthly Finance Report: {monthLabel(report.reporting_month)}
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-200 print:text-gray-700">
                  Treasurer: {preparedBy || "Finance Team"}
                </p>
              </div>

              <div className="grid gap-2 text-sm text-gray-600 dark:text-gray-200 print:text-gray-700">
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusTone(report.status)}`}
                >
                  {report.status ?? "draft"}
                </span>
                <span>Generated: {dateLabel(report.created_at)}</span>
                <span>Last updated: {dateLabel(report.updated_at)}</span>
              </div>
            </div>
          </header>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Contributors", `${contributorIds.size} / ${activeMembers.length}`, `${percent(participationRate)} participation`],
              ["Member deposits", money(approvedDeposits), "Approved and posted"],
              ["Investment return", money(interestAmount), `${percent(growthRate)} monthly growth`],
              ["Closing NAV", money(closingBalance), "SBG statement value"],
            ].map(([label, value, detail]) => (
              <div
                key={label}
                className="rounded-lg border border-gray-200 p-5 dark:border-white/15 print:border-gray-300"
              >
                <p className="text-sm text-gray-500 dark:text-gray-300 print:text-gray-600">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">
                  {value}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-300 print:text-gray-600">
                  {detail}
                </p>
              </div>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
            <div className="rounded-lg border border-gray-200 p-5 dark:border-white/15 print:border-gray-300">
              <h3 className="text-lg font-semibold text-gray-950 dark:text-white">
                Group Summary
              </h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700 dark:text-gray-100 print:text-gray-800">
                <li>
                  Total members contributing this month:{" "}
                  <strong>{contributorIds.size}</strong>
                </li>
                <li>
                  Total approved deposits received:{" "}
                  <strong>{money(approvedDeposits)}</strong>
                </li>
                <li>
                  Investment status: funds are tracked against the SBG
                  Securities Uganda Money Market Fund statement.
                </li>
                <li>
                  Managed by: SBG Securities Uganda Limited.
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-gray-200 p-5 dark:border-white/15 print:border-gray-300">
              <h3 className="text-lg font-semibold text-gray-950 dark:text-white">
                Report Health
              </h3>
              <dl className="mt-4 grid gap-3 text-sm">
                {[
                  ["Statement movement", money(statementMovement)],
                  ["Periodic return", money(periodicReturn)],
                  ["Unmatched / variance", money(report.unmatched_deposits)],
                  ["Open exceptions", String(exceptionCount)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-300 print:text-gray-600">
                      {label}
                    </dt>
                    <dd className="font-semibold text-gray-950 dark:text-white">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <ReportTable
            title={`Member Contributions - ${monthLabel(report.reporting_month)}`}
            columns={["Member", "Deposit Date", "Amount", "Emergency", "Investment", "Reference"]}
            empty="No approved member deposits were posted for this month."
            rows={approvedMonthSubmissions.map((submission) => [
              memberName(members[submission.member_id]),
              submission.deposit_date ? dateLabel(submission.deposit_date) : "No date",
              money(submission.amount),
              money(submission.emergency_amount),
              money(submission.investment_amount),
              submission.bank_reference ?? "No reference",
            ])}
            footer={["Total", "", money(sumBy(approvedMonthSubmissions, (row) => row.amount)), money(sumBy(approvedMonthSubmissions, (row) => row.emergency_amount)), money(sumBy(approvedMonthSubmissions, (row) => row.investment_amount)), ""]}
          />

          <section className="rounded-lg border border-gray-200 p-5 dark:border-white/15 print:border-gray-300">
            <h3 className="text-lg font-semibold text-gray-950 dark:text-white">
              Fund Performance
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Opening Balance", money(openingBalance)],
                ["New Approved Deposits", money(approvedDeposits)],
                ["Closing Balance (NAV)", money(closingBalance)],
                ["Periodic Return", money(periodicReturn)],
                ["Return / Profit Earned", money(interestAmount)],
                ["Monthly Growth Rate", percent(growthRate)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md border border-gray-200 px-4 py-3 dark:border-white/10 print:border-gray-300"
                >
                  <p className="text-xs uppercase text-gray-500 dark:text-gray-300 print:text-gray-600">
                    {label}
                  </p>
                  <p className="mt-1 font-semibold text-gray-950 dark:text-white">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <ReportTable
            title="Daily Weighted Interest Allocation"
            columns={["Member", "Opening Base", "Month Deposits", "Weight", "Interest"]}
            empty="No interest allocation rows have been generated for this report."
            rows={allocations.map((allocation) => [
              memberName(members[allocation.member_id]),
              money(allocation.opening_investment_balance),
              money(allocation.month_investment_deposits),
              percent((allocation.allocation_weight ?? 0) * 100),
              money(allocation.interest_amount),
            ])}
            footer={allocations.length > 0 ? ["Total", money(sumBy(allocations, (row) => row.opening_investment_balance)), money(sumBy(allocations, (row) => row.month_investment_deposits)), "100.00%", money(sumBy(allocations, (row) => row.interest_amount))] : undefined}
          />

          <ReportTable
            title="Statement Reconciliation"
            columns={["Date", "Narration", "Credit", "Reference", "Match"]}
            empty="No bank transaction rows were extracted. SBG valuation files can still produce the report from summary figures."
            rows={transactions.slice(0, 12).map((transaction) => [
              transaction.transaction_date ? dateLabel(transaction.transaction_date) : "No date",
              transaction.description ?? "No narration",
              money(transaction.credit),
              transaction.reference ?? "No reference",
              transaction.match_status ?? "unmatched",
            ])}
          />

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-5 dark:border-white/15 print:border-gray-300">
              <h3 className="text-lg font-semibold text-gray-950 dark:text-white">
                Issues and Notes
              </h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700 dark:text-gray-100 print:text-gray-800">
                <li>
                  <strong>Participation:</strong>{" "}
                  {contributorIds.size} of {activeMembers.length || "all"} approved
                  members contributed in {monthLabel(report.reporting_month)}.
                </li>
                <li>
                  <strong>Interest allocation:</strong> {money(interestAmount)} is
                  distributed by daily weighted investment balance for the month.
                </li>
                <li>
                  <strong>Pending proof:</strong> {pendingMonthSubmissions.length} member
                  submission(s) remain visible for finance follow-up but are not
                  posted to the ledger until approved.
                </li>
                {report.variance_status === "deposit_exceeds_statement" && (
                  <li>
                    <strong>Chairman attention:</strong> approved deposits exceed
                    statement movement. The report is generated but requires
                    leadership review.
                  </li>
                )}
              </ul>
              {report.notes && (
                <p className="mt-4 rounded-md bg-gray-50 p-3 text-sm leading-6 text-gray-700 dark:bg-white/5 dark:text-gray-100 print:bg-gray-100 print:text-gray-800">
                  {report.notes}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 p-5 dark:border-white/15 print:border-gray-300">
              <h3 className="text-lg font-semibold text-gray-950 dark:text-white">
                Leadership Review
              </h3>
              <div className="mt-4 grid gap-4 text-sm text-gray-700 dark:text-gray-100 print:text-gray-800">
                <div>
                  <p className="font-semibold">Treasurer certification</p>
                  <p className="mt-1 leading-6">
                    Figures are prepared from approved member deposits and the
                    uploaded monthly SBG statement.
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Chairman/Admin review</p>
                  <p className="mt-1 leading-6">
                    Confirm exceptions, approve required edits, and use this
                    report for meeting discussion and member transparency.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </article>
      )}

      {reports.length > 1 && (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/15 dark:bg-white/10 print:hidden">
          <div className="border-b border-gray-200 px-5 py-4 dark:border-white/15">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Report Archive
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/5 dark:text-gray-200">
                <tr>
                  {["Month", "Deposits", "Interest", "Closing", "Exceptions", "Status"].map((column) => (
                    <th key={column} className="px-5 py-3 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {reports.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">
                      {row.reporting_month}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                      {money(row.approved_member_deposits)}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                      {money(row.calculated_interest_amount ?? row.manual_interest_amount ?? row.unmatched_deposits)}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                      {money(row.closing_balance)}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-100">
                      {row.exception_count ?? 0}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                        {row.status ?? "draft"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function ReportTable({
  title,
  columns,
  rows,
  empty,
  footer,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  empty: string;
  footer?: string[];
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 dark:border-white/15 print:border-gray-300">
      <div className="border-b border-gray-200 px-5 py-4 dark:border-white/15 print:border-gray-300">
        <h3 className="text-lg font-semibold text-gray-950 dark:text-white">
          {title}
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500 dark:text-gray-300 print:text-gray-600">
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/5 dark:text-gray-200 print:bg-gray-100 print:text-gray-700">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-5 py-3 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10 print:divide-gray-200">
              {rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${title}-${rowIndex}-${cellIndex}`}
                      className="px-5 py-4 text-gray-700 dark:text-gray-100 print:text-gray-800"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && (
              <tfoot className="border-t border-gray-200 bg-gray-50 font-semibold text-gray-950 dark:border-white/10 dark:bg-white/5 dark:text-white print:bg-gray-100">
                <tr>
                  {footer.map((cell, index) => (
                    <td key={`${title}-footer-${index}`} className="px-5 py-4">
                      {cell}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}
