import { submitDepositProof } from "@/app/actions/deposits";
import { FeaturePage } from "@/app/components/feature/FeaturePage";
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
    (submission) => submission.status === "submitted" || submission.status === "needs_review"
  ).length;

  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Funds"
        title="Upload Deposit Proof"
        description="Submit your Stanbic/SBG Securities deposit proof for finance matching. Approved deposits are posted to your savings ledger and group totals."
        metrics={[
          { label: "Waiting for Finance", value: String(pendingCount), detail: "Submitted proofs" },
          { label: "Approved Proofs", value: String(mySubmissions.filter((row) => row.status === "approved").length), detail: "Posted to ledger" },
          { label: "Latest Submission", value: mySubmissions[0] ? money(mySubmissions[0].amount) : "None", detail: mySubmissions[0] ? dateLabel(mySubmissions[0].created_at) : "No proof uploaded" },
          { label: "Finance Check", value: "Bank match", detail: "Screenshot plus statement" },
        ]}
        sections={[
          {
            title: "How It Works",
            body: "Your upload creates a pending proof. Finance verifies the bank credit, then approves it into the official monthly contribution ledger.",
            items: ["Upload proof from bank/mobile app", "Finance matches the bank statement", "Approved amount updates personal and group records"],
          },
          {
            title: "What To Capture",
            body: "Use the exact amount and contribution month shown in your payment evidence so finance can match it quickly.",
            items: ["Deposit date", "Bank or transaction reference", "Emergency and investment split"],
          },
        ]}
        table={{
          columns: ["Month", "Amount", "Emergency", "Investment", "Status", "Submitted"],
          rows: mySubmissions.map((submission) => [
            submission.contribution_month ?? "No month",
            money(submission.amount),
            money(submission.emergency_amount),
            money(submission.investment_amount),
            <StatusPill key={submission.id} status={submission.status} />,
            dateLabel(submission.created_at),
          ]),
          empty: "You have not uploaded any deposit proof yet.",
        }}
      />

      <DepositProofForm action={submitDepositProof} />
    </div>
  );
}
