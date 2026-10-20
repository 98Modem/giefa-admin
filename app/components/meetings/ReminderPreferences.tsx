"use client";

import { useActionState, useState } from "react";
import { BellAlertIcon } from "@heroicons/react/24/outline";
import { saveReminderPreferencesAction } from "@/app/actions/meetings";
import { useBrowserTimeZone } from "./useBrowserTimeZone";

type ReminderPreferencesProps = {
  initialPhone: string;
  initialTimeZone: string;
  initialOptIn: boolean;
};

export function ReminderPreferences({
  initialPhone,
  initialTimeZone,
  initialOptIn,
}: ReminderPreferencesProps) {
  const [state, action, pending] = useActionState(
    saveReminderPreferencesAction,
    { ok: false, message: "" }
  );
  const detectedTimeZone = useBrowserTimeZone();
  const timeZone = detectedTimeZone === "UTC" ? initialTimeZone || "UTC" : detectedTimeZone;
  const [optedIn, setOptedIn] = useState(initialOptIn);

  return (
    <form
      action={action}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
          <BellAlertIcon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            My reminders
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Your detected time zone is used in every reminder.
          </p>
        </div>
      </div>

      <input type="hidden" name="time_zone" value={timeZone} />

      <label className="mt-5 block">
        <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
          WhatsApp number
        </span>
        <input
          name="phone_e164"
          type="tel"
          inputMode="tel"
          defaultValue={initialPhone}
          placeholder="+14165550123"
          className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
        />
        <span className="mt-1 block text-xs text-gray-500">
          Include the country code. Detected zone: {timeZone}
        </span>
      </label>

      <label className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-700 dark:bg-white/5 dark:text-gray-300">
        <input
          type="checkbox"
          name="whatsapp_opt_in"
          checked={optedIn}
          onChange={(event) => setOptedIn(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-500"
        />
        <span>
          I agree to receive GIEFA meeting reminders on WhatsApp. I can turn them off here at any time.
        </span>
      </label>

      {state.message && (
        <p
          role="status"
          className={`mt-4 text-sm ${state.ok ? "text-success-600" : "text-error-600"}`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex h-10 items-center rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/10"
      >
        {pending ? "Saving…" : "Save reminder settings"}
      </button>
    </form>
  );
}
