"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  approveDepositSubmission,
  rejectDepositSubmission,
} from "@/app/actions/deposits";

type ReviewSubmission = {
  id: string;
  memberName: string;
  memberEmail: string | null;
  contributionMonth: string;
  amount: string;
  emergencyAmount: string;
  investmentAmount: string;
  depositDate: string;
  bankReference: string;
  confidence: string;
  status: string;
  submittedAt: string;
  proofUrl: string;
  proofPath: string | null;
  senderName: string | null;
  sbgEmailLabel: string;
  sbgEmailDetail: string;
};

function DetailRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string | null;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-white/70 p-3 dark:bg-white/5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
        {label}
      </p>
      <p
        className={`mt-1 break-words ${
          emphasis
            ? "text-lg font-semibold text-gray-950 dark:text-white"
            : "text-sm font-medium text-gray-800 dark:text-gray-100"
        }`}
      >
        {value || "Not recorded"}
      </p>
    </div>
  );
}

export function DepositProofReview({
  submission,
}: {
  submission: ReviewSubmission;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const isPdf = useMemo(() => {
    const value = `${submission.proofPath ?? ""} ${submission.proofUrl}`.toLowerCase();
    return value.includes(".pdf");
  }, [submission.proofPath, submission.proofUrl]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const approve = () => {
    const formData = new FormData();
    formData.set("submission_id", submission.id);
    startTransition(async () => {
      await approveDepositSubmission(formData);
      setOpen(false);
    });
  };

  const reject = () => {
    const formData = new FormData();
    formData.set("submission_id", submission.id);
    formData.set("rejection_reason", reason);
    startTransition(async () => {
      await rejectDepositSubmission(formData);
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:-translate-y-0.5 hover:bg-brand-100 dark:border-brand-300/30 dark:bg-brand-400/10 dark:text-brand-100 dark:hover:bg-brand-400/20"
      >
        Review
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-md transition-opacity sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Deposit proof review"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="grid max-h-[92vh] w-full max-w-7xl animate-[proofReviewIn_180ms_ease-out] overflow-hidden rounded-3xl border border-white/20 bg-[var(--app-surface)] shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--app-border)] px-4 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                  Proof review
                </p>
                <h2 className="mt-1 text-xl font-semibold text-gray-950 dark:text-white">
                  {submission.memberName}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                  Compare the proof with the submitted details before posting to
                  the ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[var(--app-border)] bg-white/70 p-2 text-gray-600 transition hover:bg-white dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
                aria-label="Close proof review"
              >
                <span aria-hidden="true" className="block h-5 w-5 text-center text-lg leading-5">
                  x
                </span>
              </button>
            </div>

            <div className="grid min-h-0 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] lg:overflow-hidden">
              <section className="min-h-[45vh] border-b border-[var(--app-border)] bg-slate-100/70 p-3 dark:bg-slate-950/30 lg:border-b-0 lg:border-r">
                <div className="flex h-full min-h-[45vh] items-center justify-center overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white dark:bg-slate-950">
                  {isPdf ? (
                    <iframe
                      src={submission.proofUrl}
                      title={`Deposit proof for ${submission.memberName}`}
                      className="h-[72vh] w-full bg-white"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={submission.proofUrl}
                      alt={`Deposit proof for ${submission.memberName}`}
                      className="max-h-[72vh] w-full object-contain"
                    />
                  )}
                </div>
              </section>

              <section className="min-h-0 space-y-4 overflow-y-auto p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-3">
                  <DetailRow label="Amount" value={submission.amount} emphasis />
                  <DetailRow label="Month" value={submission.contributionMonth} />
                  <DetailRow label="Emergency" value={submission.emergencyAmount} />
                  <DetailRow label="Investment" value={submission.investmentAmount} />
                  <DetailRow label="Deposit date" value={submission.depositDate} />
                  <DetailRow label="Reference" value={submission.bankReference} />
                </div>

                <div className="grid gap-3">
                  <DetailRow label="Registered member" value={submission.memberName} />
                  <DetailRow label="Member email" value={submission.memberEmail} />
                  <DetailRow label="Proof sender" value={submission.senderName} />
                  <DetailRow label="AI read" value={submission.confidence} />
                  <DetailRow label="SBG email" value={submission.sbgEmailLabel} />
                  <DetailRow label="SBG detail" value={submission.sbgEmailDetail} />
                  <DetailRow label="Submitted" value={submission.submittedAt} />
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
                  Approve only after the proof matches the bank notification or
                  SBG statement. Rejected proofs remain visible for audit history.
                </div>

                {submission.status === "submitted" ||
                submission.status === "needs_review" ? (
                  <div className="grid gap-3 rounded-2xl border border-[var(--app-border)] bg-white/70 p-3 dark:bg-white/5">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={approve}
                      className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      {isPending ? "Posting..." : "Approve and Post"}
                    </button>
                    <div className="grid gap-2">
                      <label
                        htmlFor={`reject-reason-${submission.id}`}
                        className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300"
                      >
                        Rejection reason
                      </label>
                      <textarea
                        id={`reject-reason-${submission.id}`}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={3}
                        placeholder="Example: Reference not visible on bank statement."
                        className="rounded-xl border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:bg-white/10 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={reject}
                        className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60 dark:border-rose-400/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
                      >
                        Reject proof
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[var(--app-border)] bg-white/70 p-4 dark:bg-white/5">
                    <p className="text-sm font-semibold text-gray-950 dark:text-white">
                      Review completed
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                      Current status: {submission.status}
                    </p>
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <a
                    href={submission.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-[var(--app-border)] px-4 py-3 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-white/10"
                  >
                    Open original
                  </a>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-[var(--app-border)] px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-white/10"
                  >
                    Close for later
                  </button>
                </div>
              </section>
            </div>
          </div>
          <style jsx global>{`
            @keyframes proofReviewIn {
              from {
                opacity: 0;
                transform: translateY(12px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
