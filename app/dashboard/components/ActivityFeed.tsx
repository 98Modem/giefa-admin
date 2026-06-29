"use client";

const activities = [
  {
    id: 1,
    action: "Emergency request approved",
    user: "Treasurer",
    date: "2025-01-06 10:15",
  },
  {
    id: 2,
    action: "Member suspended",
    user: "General Secretary",
    date: "2025-01-05 14:20",
  },
  {
    id: 3,
    action: "Monthly contribution recorded",
    user: "System",
    date: "2025-01-01 09:00",
  },
];

export function ActivityFeed() {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-900/80 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
        Governance trail
      </p>
      <h3 className="mt-2 text-lg font-semibold text-gray-950 dark:text-white">
        Recent Activity
      </h3>

      <ul className="mt-5 space-y-1">
        {activities.map((activity) => (
          <li
            key={activity.id}
            className="group flex items-start gap-3 rounded-lg px-2 py-3 transition hover:bg-brand-50/70 dark:hover:bg-white/5"
          >
            <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 shadow-[0_0_0_4px_rgba(70,95,255,0.12)] transition group-hover:scale-110" />

            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-white">
                {activity.action}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                {activity.user} - {activity.date}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
