import { FeaturePage } from "@/app/components/feature/FeaturePage";

export default function MeetingsPage() {
  return (
    <FeaturePage
      eyebrow="Membership"
      title="Schedule Meetings"
      description="Plan association meetings, member reviews, finance sessions, and governance follow-ups."
      primaryAction={{ label: "Schedule Meeting", href: "/members/meetings" }}
      metrics={[
        { label: "Upcoming", value: "3", detail: "Scheduled meetings" },
        { label: "This Month", value: "5", detail: "Total meetings" },
        { label: "Attendance Open", value: "2", detail: "Needs recording" },
        { label: "Governance Reviews", value: "1", detail: "Chairman agenda" },
      ]}
      sections={[
        {
          title: "Meeting Types",
          body: "Meetings should support membership reviews, finance reporting, and governance decisions.",
          items: ["Membership review", "Finance close", "Governance action", "General assembly"],
        },
        {
          title: "Administration",
          body: "General Secretary schedules meetings and maintains administrative follow-up records.",
          items: ["Agenda preparation", "Attendance tracking", "Action item follow-up"],
        },
      ]}
      table={{
        columns: ["Meeting", "Date", "Owner", "Status"],
        rows: [
          ["Monthly Finance Review", "Jul 05, 2026", "Treasurer", "Scheduled"],
          ["Membership Review", "Jul 08, 2026", "General Secretary", "Scheduled"],
          ["Governance Committee", "Jul 12, 2026", "Chairman", "Draft"],
        ],
      }}
    />
  );
}
