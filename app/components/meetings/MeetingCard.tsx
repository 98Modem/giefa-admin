import Link from "next/link";
import {
  ArrowDownTrayIcon,
  MapPinIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { cancelMeetingAction } from "@/app/actions/meetings";
import {
  googleCalendarUrl,
  MeetingRecord,
  outlookCalendarUrl,
  whatsappMeetingShareUrl,
} from "@/app/lib/giefa/meetings";
import { LocalizedMeetingTime } from "./LocalizedMeetingTime";

type MeetingCardProps = {
  meeting: MeetingRecord;
  canManage?: boolean;
  detailed?: boolean;
};

export function MeetingCard({ meeting, canManage = false, detailed = false }: MeetingCardProps) {
  const cancelled = meeting.status === "cancelled";

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
            {meeting.meeting_type.replaceAll("_", " ")}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
            {meeting.title}
          </h2>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            cancelled
              ? "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300"
              : "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300"
          }`}
        >
          {meeting.status}
        </span>
      </div>

      <LocalizedMeetingTime
        startsAt={meeting.starts_at}
        endsAt={meeting.ends_at}
        className="mt-4 block font-medium text-gray-800 dark:text-gray-100"
      />
      <p className="mt-1 text-xs text-gray-500">
        Automatically converted from {meeting.source_time_zone}.
      </p>

      {meeting.description && (
        <p className={`mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300 ${detailed ? "whitespace-pre-wrap" : "line-clamp-3"}`}>
          {meeting.description}
        </p>
      )}

      <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
        {meeting.location && (
          <p className="flex items-center gap-2">
            <MapPinIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {meeting.location}
          </p>
        )}
        {meeting.meeting_url && !cancelled && (
          <a
            href={meeting.meeting_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 font-medium text-brand-600 hover:underline dark:text-brand-300"
          >
            <VideoCameraIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            Join online meeting
          </a>
        )}
      </div>

      {!cancelled && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
          <a
            href={googleCalendarUrl(meeting)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/10"
          >
            Google Calendar
          </a>
          <a
            href={outlookCalendarUrl(meeting)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/10"
          >
            Outlook
          </a>
          <a
            href={`/api/meetings/${meeting.id}/calendar`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/10"
          >
            <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
            Apple / ICS
          </a>
          {!detailed && (
            <Link
              href={`/meetings/${meeting.id}`}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-white/10"
            >
              View details
            </Link>
          )}
          {canManage && (
            <a
              href={whatsappMeetingShareUrl(meeting)}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Share to Prospects Saving Group
            </a>
          )}
        </div>
      )}

      {canManage && !cancelled && (
        <form action={cancelMeetingAction} className="mt-4">
          <input type="hidden" name="meeting_id" value={meeting.id} />
          <button className="text-xs font-semibold text-error-600 hover:underline dark:text-error-300">
            Cancel meeting
          </button>
        </form>
      )}
    </article>
  );
}
