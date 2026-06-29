type GiefaWorkOverlayProps = {
  message?: string;
};

const letters = ["G", "I", "E", "F", "A"];

export function GiefaWorkOverlay({
  message = "Securing your workspace",
}: GiefaWorkOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-[100] flex items-center justify-center bg-white/68 px-6 backdrop-blur-[3px] dark:bg-gray-950/62"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-7 py-6 text-center shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
        <div className="giefa-word-loader mx-auto flex items-center justify-center gap-1 text-3xl font-black tracking-[0.22em] text-brand-600 dark:text-brand-300">
          {letters.map((letter) => (
            <span key={letter}>{letter}</span>
          ))}
        </div>

        <div className="mx-auto mt-4 h-1.5 w-44 overflow-hidden rounded-full bg-brand-100 dark:bg-white/10">
          <div className="giefa-loader-track h-full rounded-full bg-brand-500" />
        </div>

        <p className="mt-4 text-sm font-semibold text-gray-800 dark:text-white">
          {message}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
          Please wait while GIEFA completes this action.
        </p>
      </div>
    </div>
  );
}
