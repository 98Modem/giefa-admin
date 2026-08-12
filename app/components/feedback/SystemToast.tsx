"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export type SystemToastTone = "success" | "info" | "error";

export type SystemToastDetail = {
  title: string;
  message?: string;
  tone?: SystemToastTone;
  duration?: number;
};

type VisibleToast = Required<Omit<SystemToastDetail, "message">> & {
  id: number;
  message: string;
};

const SYSTEM_TOAST_EVENT = "giefa-system-toast";
let nextToastId = 0;

export function showSystemToast(detail: SystemToastDetail) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<SystemToastDetail>(SYSTEM_TOAST_EVENT, { detail })
  );
}

function ToastCard({
  toast,
  onRemove,
}: {
  toast: VisibleToast;
  onRemove: (id: number) => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = window.setTimeout(
      () => setLeaving(true),
      Math.max(1_500, toast.duration - 450)
    );
    const removeTimer = window.setTimeout(
      () => onRemove(toast.id),
      Math.max(1_950, toast.duration)
    );

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, [onRemove, toast.duration, toast.id]);

  const close = () => {
    setLeaving(true);
    window.setTimeout(() => onRemove(toast.id), 420);
  };

  const Icon =
    toast.tone === "error"
      ? ExclamationTriangleIcon
      : toast.tone === "info"
        ? InformationCircleIcon
        : CheckCircleIcon;

  return (
    <article
      className={`giefa-system-toast pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] text-gray-950 shadow-[0_22px_60px_rgba(15,23,42,0.22)] ring-1 ring-black/5 backdrop-blur-xl dark:text-white dark:shadow-[0_24px_70px_rgba(0,0,0,0.55)] dark:ring-white/10 ${
        leaving ? "giefa-system-toast-leave" : "giefa-system-toast-enter"
      }`}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
    >
      <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
        <span
          className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-sm ${
            toast.tone === "error"
              ? "bg-rose-600"
              : toast.tone === "info"
                ? "bg-brand-500"
                : "bg-emerald-600"
          }`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold sm:text-[15px]">{toast.title}</p>
          {toast.message && (
            <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300 sm:text-sm">
              {toast.message}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={close}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-gray-500 transition hover:bg-black/5 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Close notification"
        >
          <XMarkIcon className="size-5" aria-hidden="true" />
        </button>
      </div>

      <span
        className={`giefa-system-toast-progress absolute inset-x-0 bottom-0 h-1 origin-left ${
          toast.tone === "error"
            ? "bg-rose-500"
            : toast.tone === "info"
              ? "bg-brand-500"
              : "bg-emerald-500"
        }`}
        style={{ animationDuration: `${toast.duration}ms` }}
        aria-hidden="true"
      />
    </article>
  );
}

export function SystemToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<VisibleToast[]>([]);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<SystemToastDetail>).detail;
      if (!detail?.title?.trim()) return;

      nextToastId += 1;
      const toast: VisibleToast = {
        id: nextToastId,
        title: detail.title.trim(),
        message: detail.message?.trim() ?? "",
        tone: detail.tone ?? "success",
        duration: Math.min(10_000, Math.max(3_000, detail.duration ?? 5_600)),
      };

      setToasts((current) => [...current.slice(-1), toast]);
    };

    window.addEventListener(SYSTEM_TOAST_EVENT, handleToast);
    return () => {
      window.removeEventListener(SYSTEM_TOAST_EVENT, handleToast);
    };
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[10000] flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-4">
        <div className="flex w-full max-w-md flex-col gap-2">
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </div>
      </div>
    </>
  );
}
