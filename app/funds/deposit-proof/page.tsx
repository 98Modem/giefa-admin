import { submitDepositProof } from "@/app/actions/deposits";
import {
  dateLabel,
  getCurrentMember,
  getDepositSubmissions,
  money,
} from "@/app/lib/giefa/liveData";
import { DepositProofForm } from "./DepositProofForm";

function StatusPill({ status }: { status: string | null }) {
  const tone =
    status === "approved"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
      : status === "rejected"
        ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
        : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status ?? "submitted"}
    </span>
  );
}

export default async function DepositProofPage() {
  const [member, submissions] = await Promise.all([
    getCurrentMember(),
    getDepositSubmissions(),
  ]);

  const mySubmissions = member
    ? submissions.filter((submission) => submission.member_id === member.id)
    : [];

  const pendingCount = mySubmissions.filter(
    (submission) =>
      submission.status === "submitted" || submission.status === "needs_review"
  ).length;
  const approvedCount = mySubmissions.filter(
    (submission) => submission.status === "approved"
  ).length;
  const latestSubmission = mySubmissions[0];

  return (
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
              Contribution proof
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              Upload Deposit Proof
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-200">
              Upload the payment evidence, confirm the amount and split, then send it to finance for bank matching.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm sm:min-w-[28rem]">
            <div className="rounded-xl border border-[var(--app-border)] bg-white/70 p-3 dark:bg-white/5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
                Waiting
              </p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                {pendingCount}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--app-border)] bg-white/70 p-3 dark:bg-white/5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
                Approved
              </p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                {approvedCount}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--app-border)] bg-white/70 p-3 dark:bg-white/5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
                Latest
              </p>
              <p className="mt-1 truncate text-base font-bold text-gray-900 dark:text-white">
                {latestSubmission ? money(latestSubmission.amount) : "None"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <DepositProofForm action={submitDepositProof} />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm">
        <div className="flex flex-col gap-1 border-b border-[var(--app-border)] px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            My Recent Proofs
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-300">
            Finance posts approved proof to your official ledger.
          </p>
        </div>

        {mySubmissions.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-500 dark:text-gray-300 sm:px-5">
            You have not uploaded any deposit proof yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-white/5 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 sm:px-5">Month</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Emergency</th>
                  <th className="px-4 py-3">Investment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {mySubmissions.slice(0, 6).map((submission) => (
                  <tr key={submission.id}>
                    <td className="px-4 py-4 font-semibold text-gray-900 dark:text-white sm:px-5">
                      {submission.contribution_month ?? "No month"}
                    </td>
                    <td className="px-4 py-4">{money(submission.amount)}</td>
                    <td className="px-4 py-4">
                      {money(submission.emergency_amount)}
                    </td>
                    <td className="px-4 py-4">
                      {money(submission.investment_amount)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill status={submission.status} />
                    </td>
                    <td className="px-4 py-4">
                      {dateLabel(submission.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
