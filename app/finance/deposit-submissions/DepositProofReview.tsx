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
import { showSystemToast } from "@/app/components/feedback/SystemToast";

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
  proofUrl: string | null;
  proofPath: string | null;
  senderName: string | null;
  sbgEmailLabel: string;
  sbgEmailDetail: string;
};

type Point = { x: number; y: number };

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function distanceBetween(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpointBetween(first: Point, second: Point): Point {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function DetailRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--app-border)] bg-gray-50 p-3 dark:bg-white/5">
      <p className="text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-300">
        {label}
      </p>
      <p
        className={`mt-1 break-words text-gray-950 dark:text-white ${
          emphasis ? "text-base font-bold sm:text-lg" : "text-sm font-semibold"
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
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const zoomRef = useRef(1);
  const panRef = useRef<Point>({ x: 0, y: 0 });
  const rejectionReasonRef = useRef<HTMLTextAreaElement>(null);
  const activePointers = useRef(new Map<number, Point>());
  const dragStart = useRef<{
    pointerId: number;
    point: Point;
    pan: Point;
  } | null>(null);
  const pinchStart = useRef<{
    distance: number;
    midpoint: Point;
    zoom: number;
    pan: Point;
  } | null>(null);

  const isPdf = useMemo(() => {
    const value = `${submission.proofPath ?? ""} ${submission.proofUrl}`.toLowerCase();
    return value.includes(".pdf");
  }, [submission.proofPath, submission.proofUrl]);

  const hasProof = Boolean(submission.proofPath);
  const proofIsViewable = Boolean(submission.proofUrl);
  const canDecide =
    submission.status === "submitted" || submission.status === "needs_review";
  const canApprove = canDecide && hasProof && proofIsViewable;

  const applyView = (nextZoom: number, nextPan = panRef.current) => {
    const normalizedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const normalizedPan =
      normalizedZoom === MIN_ZOOM ? { x: 0, y: 0 } : nextPan;

    zoomRef.current = normalizedZoom;
    panRef.current = normalizedPan;
    setZoom(normalizedZoom);
    setPan(normalizedPan);
  };

  const resetViewer = () => {
    activePointers.current.clear();
    dragStart.current = null;
    pinchStart.current = null;
    setIsDragging(false);
    applyView(1, { x: 0, y: 0 });
  };

  const startImageGesture = (event: PointerEvent<HTMLDivElement>) => {
    if (isPdf) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    activePointers.current.set(event.pointerId, point);

    const points = [...activePointers.current.values()];
    if (points.length === 2) {
      pinchStart.current = {
        distance: Math.max(distanceBetween(points[0], points[1]), 1),
        midpoint: midpointBetween(points[0], points[1]),
        zoom: zoomRef.current,
        pan: panRef.current,
      };
      dragStart.current = null;
      setIsDragging(true);
      return;
    }

    if (zoomRef.current > 1) {
      dragStart.current = {
        pointerId: event.pointerId,
        point,
        pan: panRef.current,
      };
      setIsDragging(true);
    }
  };

  const moveImageGesture = (event: PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(event.pointerId)) return;

    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const points = [...activePointers.current.values()];
    if (points.length >= 2 && pinchStart.current) {
      const currentDistance = Math.max(distanceBetween(points[0], points[1]), 1);
      const currentMidpoint = midpointBetween(points[0], points[1]);
      const nextZoom =
        pinchStart.current.zoom * (currentDistance / pinchStart.current.distance);

      applyView(nextZoom, {
        x:
          pinchStart.current.pan.x +
          currentMidpoint.x -
          pinchStart.current.midpoint.x,
        y:
          pinchStart.current.pan.y +
          currentMidpoint.y -
          pinchStart.current.midpoint.y,
      });
      return;
    }

    if (dragStart.current?.pointerId === event.pointerId) {
      applyView(zoomRef.current, {
        x: dragStart.current.pan.x + event.clientX - dragStart.current.point.x,
        y: dragStart.current.pan.y + event.clientY - dragStart.current.point.y,
      });
    }
  };

  const stopImageGesture = (event: PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragStart.current?.pointerId === event.pointerId) {
      dragStart.current = null;
    }

    if (activePointers.current.size < 2) {
      pinchStart.current = null;
    }

    const remaining = [...activePointers.current.entries()];
    if (remaining.length === 1 && zoomRef.current > 1) {
      const [pointerId, point] = remaining[0];
      dragStart.current = {
        pointerId,
        point,
        pan: panRef.current,
      };
    }

    setIsDragging(activePointers.current.size > 0 && zoomRef.current > 1);
  };

  const zoomImageWithWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (isPdf) return;
    event.preventDefault();
    applyView(zoomRef.current + (event.deltaY > 0 ? -0.2 : 0.2));
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
    setActionError(null);
    startTransition(async () => {
      try {
        await approveDepositSubmission(formData);
        setOpen(false);
        showSystemToast({
          title: "Deposit approved",
          message: `${submission.memberName}'s deposit was posted to the official ledger.`,
          tone: "success",
        });
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "The proof could not be approved.",
        );
      }
    });
  };

  const reject = () => {
    const rejectionReason = reason.trim();
    if (!rejectionReason) {
      setActionError("Enter a rejection reason before rejecting this submission.");
      rejectionReasonRef.current?.focus();
      rejectionReasonRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    const formData = new FormData();
    formData.set("submission_id", submission.id);
    formData.set("rejection_reason", rejectionReason);
    setActionError(null);
    startTransition(async () => {
      try {
        await rejectDepositSubmission(formData);
        setOpen(false);
        showSystemToast({
          title: "Deposit returned to member",
          message: "The rejection reason was saved and the member was notified.",
          tone: "success",
        });
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "The proof could not be rejected.",
        );
      }
    });
  };

  const openReview = () => {
    setReason("");
    setActionError(null);
    resetViewer();
    setOpen(true);
  };

  const modal = open ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md dark:bg-black/90 sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        aria-label="Deposit proof review"
        aria-modal="true"
        className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden border border-gray-200 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.55)] ring-1 ring-black/10 dark:border-white/20 dark:bg-slate-900 dark:ring-white/10 sm:h-[calc(100dvh-2rem)] sm:max-w-7xl sm:rounded-2xl"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-white/15 dark:bg-slate-900 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-950 dark:text-white sm:text-xl">
              Deposit Review
            </h2>
            <div className="hidden sm:block">
              <p className="mt-1 font-semibold text-gray-950 dark:text-white">
                {submission.memberName}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                {proofIsViewable
                  ? "Compare the proof with the submitted details before posting it."
                  : "Review the submitted details and return incomplete records to the member."}
              </p>
            </div>
          </div>
          <button
            aria-label="Close proof review"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-gray-200 bg-gray-50 text-lg font-bold text-gray-950 transition hover:bg-gray-100 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            onClick={() => setOpen(false)}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid min-h-full min-w-0 gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.65fr)]">
            <div className="relative flex h-[48dvh] min-h-[19rem] min-w-0 items-center justify-center overflow-hidden rounded-xl border border-gray-300 bg-slate-950 dark:border-white/20 sm:h-[58dvh] lg:h-full lg:min-h-[36rem]">
              {proofIsViewable && !isPdf && (
                <div className="absolute left-2 top-2 z-20 flex items-center gap-1 rounded-xl border border-white/15 bg-slate-950/90 p-1.5 text-white shadow-lg backdrop-blur sm:left-3 sm:top-3">
                  <button
                    aria-label="Zoom out"
                    className="grid size-10 place-items-center rounded-lg border border-white/15 text-xl font-bold transition hover:bg-white/10 disabled:opacity-40"
                    disabled={zoom <= MIN_ZOOM}
                    onClick={() => applyView(zoomRef.current - 0.25)}
                    type="button"
                  >
                    −
                  </button>
                  <span className="w-14 text-center text-xs font-bold tabular-nums">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    aria-label="Zoom in"
                    className="grid size-10 place-items-center rounded-lg border border-white/15 text-xl font-bold transition hover:bg-white/10 disabled:opacity-40"
                    disabled={zoom >= MAX_ZOOM}
                    onClick={() => applyView(zoomRef.current + 0.25)}
                    type="button"
                  >
                    +
                  </button>
                  <button
                    className="h-10 rounded-lg bg-brand-600 px-3 text-xs font-bold text-white transition hover:bg-brand-700"
                    onClick={resetViewer}
                    type="button"
                  >
                    Fit
                  </button>
                </div>
              )}

              {!proofIsViewable ? (
                <div className="max-w-md px-6 text-center text-white">
                  <div className="mx-auto grid size-14 place-items-center rounded-full border border-amber-300/40 bg-amber-400/15 text-2xl" aria-hidden="true">
                    !
                  </div>
                  <h3 className="mt-4 text-lg font-bold">No proof available</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    This record can be rejected for correction, but it cannot be
                    approved until a proof file is attached and available for review.
                  </p>
                </div>
              ) : isPdf ? (
                <iframe
                  className="h-full w-full bg-white"
                  src={submission.proofUrl ?? undefined}
                  title="Deposit proof PDF"
                />
              ) : (
                <div
                  aria-label="Proof image. Pinch or use the controls to zoom. Drag to pan while zoomed."
                  className={`flex h-full w-full items-center justify-center overflow-hidden ${
                    zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
                  }`}
                  onPointerCancel={stopImageGesture}
                  onPointerDown={startImageGesture}
                  onPointerMove={moveImageGesture}
                  onPointerUp={stopImageGesture}
                  onWheel={zoomImageWithWheel}
                  style={{
                    overscrollBehavior: "contain",
                    touchAction: "none",
                  }}
                >
                  {/* Signed proof URLs cannot use Next Image without broad remote host configuration. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Uploaded deposit proof"
                    className="max-h-full max-w-full select-none object-contain will-change-transform"
                    draggable={false}
                    src={submission.proofUrl ?? undefined}
                    style={{
                      transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                      transformOrigin: "center",
                      transition: isDragging ? "none" : "transform 160ms ease-out",
                    }}
                  />
                </div>
              )}
            </div>

            <aside className="min-w-0 space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <DetailRow label="Amount" value={submission.amount} emphasis />
                <DetailRow label="Month" value={submission.contributionMonth} emphasis />
                <DetailRow label="Emergency" value={submission.emergencyAmount} />
                <DetailRow label="Investment" value={submission.investmentAmount} />
                <DetailRow label="Deposit date" value={submission.depositDate} />
                <DetailRow label="Reference" value={submission.bankReference} />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <DetailRow label="Registered member" value={submission.memberName} />
                <DetailRow
                  label="Sender on proof"
                  value={submission.senderName || "Not captured"}
                />
                <DetailRow label="AI read" value={submission.confidence} />
                <DetailRow label="SBG email" value={submission.sbgEmailLabel} />
              </div>

              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-300/40 dark:bg-amber-300/10 dark:text-amber-100">
                {proofIsViewable
                  ? "Approve only after the amount, date, reference, and member match the proof and the SBG or bank record."
                  : "Approval is blocked because no reviewable proof is attached. Add a rejection reason to return this record to the member."}
              </div>

              {canDecide ? (
                <label className="block text-sm font-semibold text-gray-950 dark:text-white">
                  Rejection reason
                  <textarea
                    ref={rejectionReasonRef}
                    className="mt-2 min-h-24 w-full resize-y rounded-lg border border-gray-300 bg-white p-3 text-base text-gray-950 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/20 dark:bg-slate-950 dark:text-white"
                    onChange={(event) => {
                      setReason(event.target.value);
                      if (event.target.value.trim()) setActionError(null);
                    }}
                    placeholder="Required only when rejecting"
                    value={reason}
                  />
                </label>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/15 dark:bg-white/5">
                  <p className="text-sm font-bold text-gray-950 dark:text-white">Review completed</p>
                  <p className="mt-1 text-sm capitalize text-gray-500 dark:text-gray-300">
                    Current status: {submission.status.replaceAll("_", " ")}
                  </p>
                </div>
              )}

              {actionError && (
                <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
                  {actionError}
                </p>
              )}
            </aside>
          </div>
        </div>

        <footer className="shrink-0 border-t border-gray-200 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] dark:border-white/15 dark:bg-slate-900 sm:px-4">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 sm:flex sm:justify-end">
            {submission.proofUrl && (
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-bold text-gray-950 transition hover:bg-gray-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                href={submission.proofUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open original
              </a>
            )}
            <button
              className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-bold text-gray-950 transition hover:bg-gray-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              onClick={() => setOpen(false)}
              type="button"
            >
              Close for later
            </button>
            {canDecide && (
              <>
                <button
                  className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isPending}
                  onClick={reject}
                  type="button"
                >
                  Reject
                </button>
                <button
                  className="min-h-11 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isPending || !canApprove}
                  onClick={approve}
                  type="button"
                  title={
                    canApprove
                      ? undefined
                      : "A reviewable proof is required before approval."
                  }
                >
                  {isPending ? "Saving…" : "Approve"}
                </button>
              </>
            )}
          </div>
        </footer>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        aria-label={`Open deposit review for ${submission.memberName}, ${submission.amount}`}
        className="absolute inset-0 z-10 cursor-pointer rounded-[inherit] bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
        onClick={openReview}
        type="button"
      >
        <span className="sr-only">Open deposit review</span>
      </button>
      {typeof document !== "undefined" && modal
        ? createPortal(modal, document.body)
        : null}
    </>
  );
}
