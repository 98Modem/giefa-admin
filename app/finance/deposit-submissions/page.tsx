import {
  DepositProofReview,
} from "@/app/finance/deposit-submissions/DepositProofReview";
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

function SbgEmailStatus({ text }: { text: string | null }) {
  const { detail } = getSbgEmailDetail(text);
  const isSent = detail.toLowerCase().includes("sent");
  const isSkipped = detail.toLowerCase().includes("skipped");
  const tone = isSent
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200"
    : isSkipped
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200"
      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200";

  return (
    <span
      title={detail}
      className={`inline-flex max-w-44 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {isSent ? "Sent" : isSkipped ? "Not configured" : "Needs check"}
    </span>
  );
}

function getSbgEmailDetail(text: string | null) {
  const lines = text?.split("\n") ?? [];
  const statusLine = lines.find((line) =>
    line.includes("SBG confirmation email")
  );
  const detailLine =
    lines
      .slice(
        Math.max(
          0,
          lines.findIndex((line) =>
            line.includes("SBG confirmation email status")
          ) + 1
        )
      )
      .find((line) => line.trim().length > 0) ?? null;
  const detail = detailLine || statusLine || "Not recorded";
  const isSent = detail.toLowerCase().includes("sent");
  const isSkipped = detail.toLowerCase().includes("skipped");

  return {
    detail,
    label: isSent ? "Sent" : isSkipped ? "Not configured" : "Needs check",
  };
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
          "SBG Email",
          "Status",
          "Action",
        ],
        rows: submissions.map((submission) => {
          const proofUrl = proofUrls.get(submission.id);

          return [
            depositorLabel(submission, members),
            submission.contribution_month ?? "No month",
            money(submission.amount),
            `${money(submission.emergency_amount)} / ${money(submission.investment_amount)}`,
            submission.deposit_date ? dateLabel(submission.deposit_date) : "No date",
            submission.bank_reference ?? "No reference",
            submission.confidence !== null && submission.confidence !== undefined
              ? `${Math.round(submission.confidence * 100)}%`
              : "Manual",
            proofUrl ? "Attached" : "No file",
            <SbgEmailStatus
              key={`${submission.id}-sbg-email`}
              text={submission.extracted_text}
            />,
            <StatusPill key={`${submission.id}-status`} status={submission.status} />,
            submission.status === "submitted" || submission.status === "needs_review"
              ? proofUrl
                ? "Review"
                : "Review / reject"
              : dateLabel(submission.reviewed_at),
          ];
        }),
        rowActions: submissions.map((submission) => {
          const proofUrl = proofUrls.get(submission.id) ?? null;
          const member = members[submission.member_id];
          const registeredName = memberName(member);
          const sbgEmail = getSbgEmailDetail(submission.extracted_text);

          return (
            <DepositProofReview
              key={`${submission.id}-proof-review`}
              submission={{
                id: submission.id,
                memberName:
                  registeredName !== "Unknown member"
                    ? registeredName
                    : submission.sender_name || "Member record hidden",
                memberEmail: member?.email ?? null,
                contributionMonth: submission.contribution_month ?? "No month",
                amount: money(submission.amount),
                emergencyAmount: money(submission.emergency_amount),
                investmentAmount: money(submission.investment_amount),
                depositDate: submission.deposit_date
                  ? dateLabel(submission.deposit_date)
                  : "No date",
                bankReference: submission.bank_reference ?? "No reference",
                confidence:
                  submission.confidence !== null &&
                  submission.confidence !== undefined
                    ? `${Math.round(submission.confidence * 100)}%`
                    : "Manual",
                status: submission.status ?? "submitted",
                submittedAt: dateLabel(submission.created_at),
                proofUrl,
                proofPath: submission.proof_url,
                senderName: submission.sender_name,
                sbgEmailLabel: sbgEmail.label,
                sbgEmailDetail: sbgEmail.detail,
              }}
            />
          );
        }),
        empty: "No deposit submissions have been received yet.",
      }}
    />
  );
}
