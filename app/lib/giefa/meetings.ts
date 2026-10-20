import { supabaseServer } from "@/app/lib/supabase/server";

export type MeetingStatus = "draft" | "scheduled" | "cancelled" | "completed";

export type MeetingRecord = {
  id: string;
  title: string;
  meeting_type: string;
  description: string | null;
  location: string | null;
  meeting_url: string | null;
  starts_at: string;
  ends_at: string;
  source_time_zone: string;
  status: MeetingStatus;
  reminder_minutes: number[];
  whatsapp_enabled: boolean;
  created_by: string;
  created_at: string;
};

export type MeetingPreferences = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  phone_e164: string | null;
  time_zone: string | null;
  whatsapp_opt_in: boolean | null;
};

const meetingColumns =
  "id, title, meeting_type, description, location, meeting_url, starts_at, ends_at, source_time_zone, status, reminder_minutes, whatsapp_enabled, created_by, created_at";

export async function getUpcomingMeetings(includeCancelled = false) {
  const supabase = await supabaseServer();
  let query = supabase
    .from("meetings")
    .select(meetingColumns)
    .gte("ends_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(30);

  if (!includeCancelled) {
    query = query.eq("status", "scheduled");
  }

  const { data } = await query;
  return (data ?? []) as MeetingRecord[];
}

export async function getMeeting(meetingId: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("meetings")
    .select(meetingColumns)
    .eq("id", meetingId)
    .maybeSingle<MeetingRecord>();

  return data;
}

export async function getMeetingPreferences() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const { data } = await supabase
    .from("members")
    .select(
      "id, first_name, last_name, role, phone_e164, time_zone, whatsapp_opt_in"
    )
    .eq("auth_user_id", session.user.id)
    .maybeSingle<MeetingPreferences>();

  return data;
}

export function calendarStamp(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function googleCalendarUrl(meeting: MeetingRecord) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.title,
    dates: `${calendarStamp(meeting.starts_at)}/${calendarStamp(meeting.ends_at)}`,
    details: meeting.description ?? "GIEFA meeting",
    location: meeting.meeting_url || meeting.location || "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(meeting: MeetingRecord) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: meeting.title,
    startdt: meeting.starts_at,
    enddt: meeting.ends_at,
    body: meeting.description ?? "GIEFA meeting",
    location: meeting.meeting_url || meeting.location || "",
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function whatsappMeetingShareUrl(meeting: MeetingRecord) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://giefa.org").replace(
    /\/$/,
    ""
  );
  let organizerTime = meeting.starts_at;
  try {
    organizerTime = new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: meeting.source_time_zone,
    }).format(new Date(meeting.starts_at));
  } catch {
    // Keep the exact ISO instant if a legacy row contains an invalid zone.
  }

  const message = [
    "Prospects Saving Group — GIEFA meeting",
    meeting.title,
    `Time: ${organizerTime} (${meeting.source_time_zone})`,
    meeting.meeting_url || meeting.location,
    `${siteUrl}/meetings/${meeting.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
