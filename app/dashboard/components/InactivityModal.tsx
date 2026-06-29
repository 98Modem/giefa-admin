"use client";

export default function InactivityModal({
  countdown,
  onContinue,
}: {
  countdown: number;
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-950/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white p-6 text-center shadow-2xl dark:bg-gray-950">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-lg font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          {countdown}
        </div>

        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Session expiring
        </h2>

        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
          You have been inactive. For your security, GIEFA will sign you out in{" "}
          <span className="font-semibold text-red-600 dark:text-red-300">
            {countdown}
          </span>{" "}
          seconds.
        </p>

        <button
          type="button"
          onClick={onContinue}
          className="mt-5 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          Continue session
        </button>
      </div>
    </div>
  );
}
