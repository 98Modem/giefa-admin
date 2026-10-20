import { getMeeting } from "@/app/lib/giefa/meetings";
import { supabaseServer } from "@/app/lib/supabase/server";

function escapeCalendarText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function stamp(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function safeFilename(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9 -]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "giefa-meeting"
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) return new Response("Meeting not found", { status: 404 });
  if (meeting.status === "cancelled") {
    return new Response("This meeting was cancelled", { status: 410 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://giefa.org";
  const detailsUrl = `${siteUrl.replace(/\/$/, "")}/meetings/${meeting.id}`;
  const description = [
    meeting.description,
    meeting.meeting_url ? `Join: ${meeting.meeting_url}` : null,
    `Details: ${detailsUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GIEFA//Meeting Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@giefa.org`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(meeting.starts_at)}`,
    `DTEND:${stamp(meeting.ends_at)}`,
    `SUMMARY:${escapeCalendarText(meeting.title)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
    `LOCATION:${escapeCalendarText(meeting.location || meeting.meeting_url || "Online")}`,
    `URL:${meeting.meeting_url || detailsUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename(meeting.title)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
