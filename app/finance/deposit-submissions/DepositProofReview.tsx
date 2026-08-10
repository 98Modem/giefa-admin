"use client";

import {
  type PointerEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dragStart = useRef<{
    pointerId: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

  const isPdf = useMemo(() => {
    const value = `${submission.proofPath ?? ""} ${submission.proofUrl}`.toLowerCase();
    return value.includes(".pdf");
  }, [submission.proofPath, submission.proofUrl]);

  const canDecide =
    submission.status === "submitted" || submission.status === "needs_review";

  const zoomLabel = `${Math.round(zoom * 100)}%`;

  const updateZoom = (nextZoom: number) => {
    const normalizedZoom = Math.min(3, Math.max(0.75, nextZoom));
    setZoom(normalizedZoom);
    if (normalizedZoom <= 1) setPan({ x: 0, y: 0 });
  };

  const resetViewer = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const startImageDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (isPdf || zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsDragging(true);
  };

  const moveImageDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current || dragStart.current.pointerId !== event.pointerId) {
      return;
    }

    setPan({
      x: dragStart.current.panX + event.clientX - dragStart.current.x,
      y: dragStart.current.panY + event.clientY - dragStart.current.y,
    });
  };

  const stopImageDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStart.current = null;
    setIsDragging(false);
  };

  const zoomImageWithWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (isPdf) return;
    event.preventDefault();
    updateZoom(zoom + (event.deltaY > 0 ? -0.15 : 0.15));
  };

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
        onClick={() => {
          resetViewer();
          setOpen(true);
        }}
        className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:-translate-y-0.5 hover:bg-brand-100 dark:border-brand-300/30 dark:bg-brand-400/10 dark:text-brand-100 dark:hover:bg-brand-400/20"
      >
        Review
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          className="fixed inset-x-0 inset-y-0 z-[100000] isolate overflow-y-auto overscroll-contain bg-slate-950/75 p-2 backdrop-blur-md transition-opacity sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Deposit proof review"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="flex min-h-full items-start justify-center sm:items-center">
          <div
            className="flex max-h-[calc(100dvh-1rem)] w-[min(100%,92rem)] animate-[proofReviewIn_180ms_ease-out] flex-col overflow-hidden rounded-2xl border border-white/20 bg-[var(--app-surface)] shadow-2xl ring-1 ring-black/5 dark:ring-white/10 sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-3xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--app-border)] px-4 py-4 sm:px-6">
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

            <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.18fr)_minmax(20rem,0.82fr)]">
              <section className="min-h-[42dvh] border-b border-[var(--app-border)] bg-slate-100/70 p-2 dark:bg-slate-950/30 sm:min-h-[50dvh] sm:p-3 lg:min-h-0 lg:border-b-0 lg:border-r">
                <div
                  className={`relative flex h-full min-h-[42dvh] items-center justify-center overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white dark:bg-slate-950 sm:min-h-[50dvh] ${
                    !isPdf && zoom > 1
                      ? isDragging
                        ? "cursor-grabbing"
                        : "cursor-grab"
                      : ""
                  }`}
                  onPointerDown={startImageDrag}
                  onPointerMove={moveImageDrag}
                  onPointerUp={stopImageDrag}
                  onPointerCancel={stopImageDrag}
                  onWheel={zoomImageWithWheel}
                  style={{ touchAction: !isPdf && zoom > 1 ? "none" : "pan-y" }}
                >
                  {!isPdf && (
                    <div className="absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded-2xl border border-white/70 bg-white/90 p-1.5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/90 sm:left-3 sm:top-3 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => updateZoom(zoom - 0.25)}
                        className="h-9 min-w-9 rounded-xl border border-[var(--app-border)] px-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:text-white dark:hover:bg-white/10"
                        aria-label="Zoom out"
                      >
                        -
                      </button>
                      <span className="min-w-14 text-center text-xs font-semibold text-gray-700 dark:text-gray-100">
                        {zoomLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateZoom(zoom + 0.25)}
                        className="h-9 min-w-9 rounded-xl border border-[var(--app-border)] px-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:text-white dark:hover:bg-white/10"
                        aria-label="Zoom in"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={resetViewer}
                        className="h-9 rounded-xl bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700"
                      >
                        Center
                      </button>
                    </div>
                  )}
                  {isPdf ? (
                    <iframe
                      src={submission.proofUrl}
                      title={`Deposit proof for ${submission.memberName}`}
                      className="h-[58dvh] w-full bg-white sm:h-[72dvh]"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={submission.proofUrl}
                      alt={`Deposit proof for ${submission.memberName}`}
                      draggable={false}
                      className={`max-h-[68dvh] max-w-full select-none object-contain sm:max-h-[72dvh] ${
                        isDragging ? "" : "transition-transform duration-150"
                      }`}
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: "center",
                      }}
                    />
                  )}
                </div>
              </section>

              <section className="min-h-0 space-y-4 overflow-y-auto p-3 sm:p-5">
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
                  <DetailRow label="Proof sender" value={submission.senderName} />
                  <DetailRow
                    label="SBG email"
                    value={
                      submission.sbgEmailLabel === "Sent"
                        ? "Sent to SBG"
                        : "Needs email check"
                    }
                  />
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
                  Approve only after the proof matches the bank notification or
                  SBG statement. Rejected proofs remain visible for audit history.
                </div>

                {canDecide ? (
                  <div className="rounded-2xl border border-[var(--app-border)] bg-white/70 p-3 dark:bg-white/5">
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

              </section>
            </div>

            <div className="sticky bottom-0 z-20 grid shrink-0 gap-3 border-t border-[var(--app-border)] bg-white/95 px-4 py-3 backdrop-blur dark:bg-slate-950/95 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <p className="text-xs text-gray-500 dark:text-gray-300">
                Review the proof image, compare amount/date/reference/member,
                then post to the ledger or reject for correction.
              </p>
              <div className="grid gap-2 sm:flex sm:justify-end">
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
                {canDecide && (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={reject}
                      className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60 dark:border-rose-400/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
                    >
                      Reject proof
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={approve}
                      className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      {isPending ? "Posting..." : "Approve and Post"}
                    </button>
                  </>
                )}
              </div>
            </div>
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
        </div>,
        document.body,
      )}
    </>
  );
}
