import {
  dateLabel,
  getBankStatementImports,
  getBankStatementTransactions,
  getFinanceMonthlyReports,
  getMemberLookup,
  getDepositSubmissions,
  memberName,
  money,
  sumBy,
} from "@/app/lib/giefa/liveData";
import { supabaseServer } from "@/app/lib/supabase/server";
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
  const [imports, transactions, reports, members, submissions] = await Promise.all([
    getBankStatementImports(),
    getBankStatementTransactions(),
    getFinanceMonthlyReports(),
    getMemberLookup(),
    getDepositSubmissions("approved"),
  ]);
  const latestImport = imports[0];
  const latestTransactions = latestImport
    ? transactions.filter((row) => row.statement_import_id === latestImport.id)
    : [];
  const latestReport = reports[0];
  const statementUrls = new Map<string, string>();
  const submissionLookup = new Map(submissions.map((submission) => [submission.id, submission]));

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

  const matchedValue = sumBy(latestTransactions, (row) =>
    row.matched_submission_id ? row.credit : 0
  );
  const unmatchedValue = sumBy(latestTransactions, (row) =>
    row.matched_submission_id ? 0 : row.credit
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
            ["Matched deposits", money(matchedValue), "Approved submissions found"],
            ["Unmatched deposits", money(unmatchedValue), "Needs finance review"],
            ["Exceptions", String(latestReport?.exception_count ?? 0), "Possible and unmatched rows"],
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
                  {["Month", "Deposits", "Matched", "Unmatched", "Closing", "File", "Status"].map((column) => (
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
                        {money(report.unmatched_deposits)}
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
            Latest Statement Matching
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            {latestImport
              ? `${latestImport.reporting_month} import from ${dateLabel(latestImport.created_at)}`
              : "Upload a statement to see matching results."}
          </p>
        </div>
        {latestTransactions.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-gray-200">
            No parsed statement transactions are available yet.
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
