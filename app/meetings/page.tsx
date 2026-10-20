import Link from "next/link";
import { MeetingCard } from "@/app/components/meetings/MeetingCard";
import { ReminderPreferences } from "@/app/components/meetings/ReminderPreferences";
import {
  getMeetingPreferences,
  getUpcomingMeetings,
} from "@/app/lib/giefa/meetings";

export default async function MyMeetingsPage() {
  const [meetings, preferences] = await Promise.all([
    getUpcomingMeetings(),
    getMeetingPreferences(),
  ]);
  const canManage = ["general_sec", "chairman", "admin"].includes(
    preferences?.role ?? ""
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
            Association calendar
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            My meetings
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            Meeting times below are automatically displayed in the time zone reported by your device. Calendar downloads contain UTC time and adjust again if you travel.
          </p>
        </div>
        {canManage && (
          <Link
            href="/members/meetings"
            className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Schedule a meeting
          </Link>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Upcoming
          </h2>
          {meetings.length ? (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              No meetings are scheduled yet.
            </div>
          )}
        </section>

        <aside>
          <ReminderPreferences
            initialPhone={preferences?.phone_e164 ?? ""}
            initialTimeZone={preferences?.time_zone ?? "UTC"}
            initialOptIn={preferences?.whatsapp_opt_in ?? false}
          />
        </aside>
      </div>
    </div>
  );
}
