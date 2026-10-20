export type MeetingReminderJob = {
  delivery_id: string;
  reminder_minutes: number;
  member_name: string;
  phone_e164: string;
  time_zone: string;
  meeting_id: string;
  meeting_title: string;
  meeting_description: string | null;
  meeting_location: string | null;
  meeting_url: string | null;
  starts_at: string;
  ends_at: string;
};

type WhatsAppResponse = {
  messages?: Array<{ id: string }>;
  error?: { message?: string; error_user_msg?: string };
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function assertWhatsAppConfigured() {
  required("WHATSAPP_ACCESS_TOKEN");
  required("WHATSAPP_PHONE_NUMBER_ID");
  required("WHATSAPP_MEETING_REMINDER_TEMPLATE");
}

function templateText(value: string, fallback: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return (normalized || fallback).slice(0, 900);
}

function memberDateTime(job: MeetingReminderJob) {
  const requestedZone = job.time_zone || "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: requestedZone,
    }).format(new Date(job.starts_at));
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(job.starts_at));
  }
}

export async function sendMeetingReminder(job: MeetingReminderJob) {
  const accessToken = required("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = required("WHATSAPP_PHONE_NUMBER_ID");
  const templateName = required("WHATSAPP_MEETING_REMINDER_TEMPLATE");
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v26.0";
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en_US";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://giefa.org").replace(
    /\/$/,
    ""
  );
  const detailsUrl = `${siteUrl}/meetings/${job.meeting_id}`;

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: job.phone_e164.replace(/\D/g, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: templateText(job.member_name, "GIEFA member") },
                { type: "text", text: templateText(job.meeting_title, "GIEFA meeting") },
                { type: "text", text: memberDateTime(job) },
                {
                  type: "text",
                  text: templateText(
                    job.meeting_location || (job.meeting_url ? "Online meeting" : "See meeting details"),
                    "See meeting details"
                  ),
                },
                { type: "text", text: detailsUrl },
              ],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );

  const payload = (await response.json().catch(() => ({}))) as WhatsAppResponse;
  if (!response.ok) {
    throw new Error(
      payload.error?.error_user_msg ||
        payload.error?.message ||
        `WhatsApp returned HTTP ${response.status}.`
    );
  }

  const messageId = payload.messages?.[0]?.id;
  if (!messageId) throw new Error("WhatsApp accepted the request without a message ID.");
  return messageId;
}
