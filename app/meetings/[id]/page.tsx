import Link from "next/link";
import { notFound } from "next/navigation";
import { MeetingCard } from "@/app/components/meetings/MeetingCard";
import { getMeeting, getMeetingPreferences } from "@/app/lib/giefa/meetings";

export default async function MeetingDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [meeting, preferences] = await Promise.all([
    getMeeting(id),
    getMeetingPreferences(),
  ]);

  if (!meeting) notFound();

  const canManage = ["general_sec", "chairman", "admin"].includes(
    preferences?.role ?? ""
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <Link
        href="/meetings"
        className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300"
      >
        ← Back to my meetings
      </Link>
      <MeetingCard meeting={meeting} canManage={canManage} detailed />
    </div>
  );
}
