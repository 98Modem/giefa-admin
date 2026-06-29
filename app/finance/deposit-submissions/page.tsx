import {
  approveDepositSubmission,
  rejectDepositSubmission,
} from "@/app/actions/deposits";
import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  dateLabel,
  getDepositSubmissions,
  getMemberLookup,
  memberName,
  money,
  sumBy,
} from "@/app/lib/giefa/liveData";
import { supabaseServer } from "@/app/lib/supabase/server";

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

function depositorLabel(
  submission: {
    member_id: string;
    sender_name: string | null;
  },
  members: Awaited<ReturnType<typeof getMemberLookup>>
) {
  const registeredName = memberName(members[submission.member_id]);

  if (registeredName !== "Unknown member") {
    return (
      <div>
        <p className="font-semibold text-gray-900 dark:text-white">
          {registeredName}
        </p>
        {submission.sender_name && submission.sender_name !== registeredName && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
            Proof sender: {submission.sender_name}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="font-semibold text-gray-900 dark:text-white">
        {submission.sender_name || "Member record hidden"}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
        Member ID: {submission.member_id.slice(0, 8)}
      </p>
    </div>
  );
}

export default async function DepositSubmissionsPage() {
  const supabase = await supabaseServer();
  const [submissions, members] = await Promise.all([
    getDepositSubmissions(),
    getMemberLookup(),
  ]);
  const proofUrls = new Map<string, string>();

  await Promise.all(
    submissions.map(async (submission) => {
      if (!submission.proof_url) return;
      const { data } = await supabase.storage
        .from("deposit-proofs")
        .createSignedUrl(submission.proof_url, 60 * 10);

      if (data?.signedUrl) {
        proofUrls.set(submission.id, data.signedUrl);
      }
    })
  );

  const pending = submissions.filter(
    (row) => row.status === "submitted" || row.status === "needs_review"
  );
  const approved = submissions.filter((row) => row.status === "approved");
  const rejected = submissions.filter((row) => row.status === "rejected");

  return (
    <FeaturePage
      eyebrow="Finance"
      title="Deposit Reviews"
      description="Review member deposit proof, match it to the Stanbic/SBG Securities bank activity, and post approved deposits to the official savings ledger."
      metrics={[
        { label: "Pending Match", value: String(pending.length), detail: "Needs finance review" },
        { label: "Pending Value", value: money(sumBy(pending, (row) => row.amount)), detail: "Not posted yet" },
        { label: "Posted Value", value: money(sumBy(approved, (row) => row.amount)), detail: "Approved submissions" },
        { label: "Rejected", value: String(rejected.length), detail: "Returned to member" },
      ]}
      sections={[
        {
          title: "Finance Control",
          body: "Screenshots are treated as supporting evidence. The official ledger changes only after finance confirms that the bank account received the deposit.",
          items: ["Compare proof with bank notification", "Check statement date and narration", "Approve only matched credits"],
        },
        {
          title: "Accounting Effect",
          body: "Approval writes the contribution into monthly_contributions and updates emergency fund and investment share balances.",
          items: ["Member ledger", "Group totals", "Audit log and notification"],
        },
        {
          title: "Future Automation",
          body: "The table is ready for OCR and bank-statement imports so references can be auto-matched before finance makes the final decision.",
          items: ["Screenshot extraction", "Statement import", "Exception queue"],
        },
      ]}
      table={{
        columns: [
          "Member",
          "Month",
          "Amount",
          "Split",
          "Deposit",
          "Reference",
          "AI Read",
          "Proof",
          "Status",
          "Action",
        ],
        rows: submissions.map((submission) => [
          depositorLabel(submission, members),
          submission.contribution_month ?? "No month",
          money(submission.amount),
          `${money(submission.emergency_amount)} / ${money(submission.investment_amount)}`,
          submission.deposit_date ? dateLabel(submission.deposit_date) : "No date",
          submission.bank_reference ?? "No reference",
          submission.confidence !== null && submission.confidence !== undefined
            ? `${Math.round(submission.confidence * 100)}%`
            : "Manual",
          proofUrls.get(submission.id) ? (
            <a
              key={`${submission.id}-proof`}
              href={proofUrls.get(submission.id)}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-600 hover:underline dark:text-brand-300"
            >
              View
            </a>
          ) : (
            "No file"
          ),
          <StatusPill key={`${submission.id}-status`} status={submission.status} />,
          submission.status === "submitted" || submission.status === "needs_review" ? (
            <div key={`${submission.id}-actions`} className="flex min-w-56 flex-col gap-2">
              <form action={approveDepositSubmission}>
                <input type="hidden" name="submission_id" value={submission.id} />
                <button
                  type="submit"
                  className="w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Approve and Post
                </button>
              </form>
              <form action={rejectDepositSubmission} className="grid gap-2">
                <input type="hidden" name="submission_id" value={submission.id} />
                <input
                  name="rejection_reason"
                  placeholder="Reason if rejected"
                  className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 dark:border-white/15 dark:bg-white/10 dark:text-white"
                />
                <button
                  type="submit"
                  className="w-full rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
                >
                  Reject
                </button>
              </form>
            </div>
          ) : (
            dateLabel(submission.reviewed_at)
          ),
        ]),
        empty: "No deposit submissions have been received yet.",
      }}
    />
  );
}
