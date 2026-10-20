"use client";

import { useActionState, useMemo, useState } from "react";
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { scheduleMeetingAction } from "@/app/actions/meetings";
import { useBrowserTimeZone } from "./useBrowserTimeZone";

function utcValue(localValue: string) {
  if (!localValue) return "";
  const date = new Date(localValue);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export function MeetingScheduler() {
  const [state, action, pending] = useActionState(
    scheduleMeetingAction,
    { ok: false, message: "" }
  );
  const [startLocal, setStartLocal] = useState("");
  const timeZone = useBrowserTimeZone();
  const startsAtUtc = useMemo(() => utcValue(startLocal), [startLocal]);

  return (
    <form
      action={action}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-6"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <CalendarDaysIcon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Schedule a meeting
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Times are saved in UTC and shown to every member in their own region.
          </p>
        </div>
      </div>

      <input type="hidden" name="starts_at_utc" value={startsAtUtc} />
      <input type="hidden" name="source_time_zone" value={timeZone} />

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Meeting title
          </span>
          <input
            required
            minLength={3}
            maxLength={160}
            name="title"
            placeholder="Monthly general meeting"
            className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Type
          </span>
          <select
            name="meeting_type"
            className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="general_assembly">General assembly</option>
            <option value="finance">Finance review</option>
            <option value="membership">Membership review</option>
            <option value="governance">Governance</option>
            <option value="committee">Committee</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
            <ClockIcon className="h-4 w-4" aria-hidden="true" />
            Start in your local time
          </span>
          <input
            required
            type="datetime-local"
            value={startLocal}
            onChange={(event) => setStartLocal(event.target.value)}
            className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
          <span className="mt-1 block text-xs text-gray-500">
            Detected zone: {timeZone}
          </span>
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Duration
          </span>
          <select
            name="duration_minutes"
            defaultValue="60"
            className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1 hour 30 minutes</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
          </select>
        </label>

        <label>
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
            <VideoCameraIcon className="h-4 w-4" aria-hidden="true" />
            Online meeting link
          </span>
          <input
            type="url"
            name="meeting_url"
            placeholder="https://meet.google.com/..."
            className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <label>
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
            <MapPinIcon className="h-4 w-4" aria-hidden="true" />
            Physical location
          </span>
          <input
            name="location"
            placeholder="Community hall or office"
            className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Agenda or notes
          </span>
          <textarea
            name="description"
            rows={4}
            placeholder="What members should prepare, agenda items, or joining instructions."
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>
      </div>

      <fieldset className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
          WhatsApp reminder times
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          {[
            [10080, "1 week before"],
            [1440, "1 day before"],
            [60, "1 hour before"],
            [15, "15 minutes before"],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                name="reminder_minutes"
                value={value}
                defaultChecked={value === 1440 || value === 60}
                className="h-4 w-4 accent-brand-500"
              />
              {label}
            </label>
          ))}
        </div>
        <label className="mt-4 flex items-start gap-2 border-t border-gray-100 pt-4 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
          <input
            type="checkbox"
            name="whatsapp_enabled"
            defaultChecked
            className="mt-0.5 h-4 w-4 accent-brand-500"
          />
          Queue reminders for members who have opted in and saved a WhatsApp number.
        </label>
      </fieldset>

      {state.message && (
        <div
          role="status"
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            state.ok
              ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300"
              : "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300"
          }`}
        >
          <p>{state.message}</p>
          {state.whatsappShareUrl && (
            <a
              href={state.whatsappShareUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex rounded-md bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700"
            >
              Share to Prospects Saving Group
            </a>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !startsAtUtc}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Scheduling…" : "Schedule meeting"}
      </button>
    </form>
  );
}
