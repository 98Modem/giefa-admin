import { MeetingCard } from "@/app/components/meetings/MeetingCard";
import { MeetingScheduler } from "@/app/components/meetings/MeetingScheduler";
import { getUpcomingMeetings } from "@/app/lib/giefa/meetings";

export default async function ManageMeetingsPage() {
  const meetings = await getUpcomingMeetings(true);
  const scheduled = meetings.filter((meeting) => meeting.status === "scheduled");
  const whatsappEnabled = scheduled.filter((meeting) => meeting.whatsapp_enabled);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
          General Secretary workspace
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          Schedule meetings
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          Create one meeting time. GIEFA stores it as an exact UTC instant, converts it for every member, and queues WhatsApp reminders for members who consented.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Upcoming" value={String(scheduled.length)} detail="Active meetings" />
        <Metric label="WhatsApp" value={String(whatsappEnabled.length)} detail="Reminder-enabled" />
        <Metric label="Time handling" value="Automatic" detail="Per member region" />
      </div>

      <MeetingScheduler />

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upcoming meeting register
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Calendar links always carry the exact UTC time, so Google, Outlook, and Apple Calendar display it correctly for each person.
          </p>
        </div>

        {meetings.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {meetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} canManage />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            No upcoming meetings. Use the form above to schedule the first one.
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  );
}
