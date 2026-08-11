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
    <div className="min-w-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
      <p className="text-[10px] font-semibold uppercase text-[var(--app-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 break-words text-[var(--app-text)] ${
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

  const canDecide =
    submission.status === "submitted" || submission.status === "needs_review";

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
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "The proof could not be approved.",
        );
      }
    });
  };

  const reject = () => {
    const formData = new FormData();
    formData.set("submission_id", submission.id);
    formData.set("rejection_reason", reason);
    setActionError(null);
    startTransition(async () => {
      try {
        await rejectDepositSubmission(formData);
        setOpen(false);
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        aria-label="Deposit proof review"
        aria-modal="true"
        className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden border border-[var(--app-border)] bg-[var(--app-bg)] shadow-2xl sm:h-[calc(100dvh-2rem)] sm:max-w-7xl sm:rounded-2xl"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--app-text)] sm:text-xl">
              Proof Review
            </h2>
            <div className="hidden sm:block">
              <p className="mt-1 font-semibold text-[var(--app-text)]">
                {submission.memberName}
              </p>
              <p className="mt-1 text-sm text-[var(--app-muted)]">
                Compare the proof with the submitted details before posting it.
              </p>
            </div>
          </div>
          <button
            aria-label="Close proof review"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--app-border)] bg-[var(--app-bg)] text-lg font-bold text-[var(--app-text)] transition hover:bg-[var(--app-hover)]"
            onClick={() => setOpen(false)}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid min-h-full min-w-0 gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.65fr)]">
            <div className="relative flex h-[48dvh] min-h-[19rem] min-w-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--app-border)] bg-slate-950 sm:h-[58dvh] lg:h-full lg:min-h-[36rem]">
              {!isPdf && (
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
                    className="h-10 rounded-lg bg-[var(--app-accent)] px-3 text-xs font-bold text-white transition hover:brightness-110"
                    onClick={resetViewer}
                    type="button"
                  >
                    Fit
                  </button>
                </div>
              )}

              {isPdf ? (
                <iframe
                  className="h-full w-full bg-white"
                  src={submission.proofUrl}
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
                  <img
                    alt="Uploaded deposit proof"
                    className="max-h-full max-w-full select-none object-contain will-change-transform"
                    draggable={false}
                    src={submission.proofUrl}
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

              <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm leading-6 text-[var(--app-text)]">
                Approve only after the amount, date, reference, and member match the
                proof and the SBG or bank record.
              </div>

              {canDecide ? (
                <label className="block text-sm font-semibold text-[var(--app-text)]">
                  Rejection reason
                  <textarea
                    className="mt-2 min-h-24 w-full resize-y rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-base text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Required only when rejecting"
                    value={reason}
                  />
                </label>
              ) : (
                <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
                  <p className="text-sm font-bold text-[var(--app-text)]">Review completed</p>
                  <p className="mt-1 text-sm capitalize text-[var(--app-muted)]">
                    Current status: {submission.status.replaceAll("_", " ")}
                  </p>
                </div>
              )}

              {actionError && (
                <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-300">
                  {actionError}
                </p>
              )}
            </aside>
          </div>
        </div>

        <footer className="shrink-0 border-t border-[var(--app-border)] bg-[var(--app-surface)] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-4">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 sm:flex sm:justify-end">
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--app-border)] px-4 text-sm font-bold text-[var(--app-text)] transition hover:bg-[var(--app-hover)]"
              href={submission.proofUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open original
            </a>
            <button
              className="min-h-11 rounded-lg border border-[var(--app-border)] px-4 text-sm font-bold text-[var(--app-text)] transition hover:bg-[var(--app-hover)]"
              onClick={() => setOpen(false)}
              type="button"
            >
              Close for later
            </button>
            {canDecide && (
              <>
                <button
                  className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isPending || !reason.trim()}
                  onClick={reject}
                  type="button"
                >
                  Reject
                </button>
                <button
                  className="min-h-11 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isPending}
                  onClick={approve}
                  type="button"
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
        className="font-semibold text-[var(--app-accent)] underline-offset-4 hover:underline"
        onClick={openReview}
        type="button"
      >
        View
      </button>
      {typeof document !== "undefined" && modal
        ? createPortal(modal, document.body)
        : null}
    </>
  );
}
