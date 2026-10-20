type MeetingEmailRecipient = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  time_zone: string | null;
};

type MeetingEmailDetails = {
  id: string;
  title: string;
  description: string;
  location: string;
  meetingUrl: string;
  startsAt: string;
  endsAt: string;
};

type ResendBatchResponse = {
  data?: Array<{ id: string }>;
  message?: string;
  error?: { message?: string };
};

function html(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatForMember(value: string, requestedTimeZone: string | null) {
  const timeZone = requestedTimeZone || "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value));
  }
}

function calendarStamp(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function googleCalendarLink(meeting: MeetingEmailDetails) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.title,
    dates: `${calendarStamp(meeting.startsAt)}/${calendarStamp(meeting.endsAt)}`,
    details: meeting.description || "GIEFA meeting",
    location: meeting.meetingUrl || meeting.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function memberName(recipient: MeetingEmailRecipient) {
  return (
    [recipient.first_name, recipient.last_name].filter(Boolean).join(" ") ||
    "GIEFA member"
  );
}

export async function sendMeetingInvitationEmails(
  meeting: MeetingEmailDetails,
  recipients: MeetingEmailRecipient[]
) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.GIEFA_EMAIL_FROM?.trim();
  const replyTo = process.env.GIEFA_EMAIL_REPLY_TO?.trim();
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and GIEFA_EMAIL_FROM are required for meeting email invitations.");
  }

  const uniqueRecipients = Array.from(
    new Map(
      recipients
        .filter((recipient) => recipient.email?.trim())
        .map((recipient) => [recipient.email!.trim().toLowerCase(), recipient])
    ).values()
  );
  if (!uniqueRecipients.length) return 0;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://giefa.org").replace(
    /\/$/,
    ""
  );
  const detailsUrl = `${siteUrl}/meetings/${meeting.id}`;
  const calendarUrl = googleCalendarLink(meeting);
  const chunks: MeetingEmailRecipient[][] = [];
  for (let index = 0; index < uniqueRecipients.length; index += 100) {
    chunks.push(uniqueRecipients.slice(index, index + 100));
  }

  let sent = 0;
  for (const [chunkIndex, chunk] of chunks.entries()) {
    const payload = chunk.map((recipient) => {
      const name = memberName(recipient);
      const localTime = formatForMember(meeting.startsAt, recipient.time_zone);
      const place = meeting.meetingUrl || meeting.location || "See meeting details";

      return {
        from,
        to: [recipient.email!.trim()],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: `GIEFA meeting: ${meeting.title}`,
        text: [
          `Hello ${name},`,
          "",
          `A GIEFA meeting has been scheduled: ${meeting.title}`,
          `Your local time: ${localTime}`,
          `Location: ${place}`,
          meeting.description ? `Agenda: ${meeting.description}` : null,
          "",
          `Meeting details: ${detailsUrl}`,
          `Add to Google Calendar: ${calendarUrl}`,
        ]
          .filter(Boolean)
          .join("\n"),
        html: `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#111827;line-height:1.6">
            <p>Hello ${html(name)},</p>
            <h1 style="font-size:22px;line-height:1.3;margin:16px 0">${html(meeting.title)}</h1>
            <p>A GIEFA meeting has been scheduled.</p>
            <div style="background:#f3f4f6;border-radius:12px;padding:16px;margin:20px 0">
              <p style="margin:0 0 8px"><strong>Your local time:</strong> ${html(localTime)}</p>
              <p style="margin:0"><strong>Location:</strong> ${html(place)}</p>
            </div>
            ${meeting.description ? `<p>${html(meeting.description).replaceAll("\n", "<br>")}</p>` : ""}
            <p>
              <a href="${html(detailsUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:11px 16px;border-radius:8px;font-weight:600">Open meeting details</a>
              &nbsp;
              <a href="${html(calendarUrl)}" style="display:inline-block;color:#2563eb;padding:11px 4px;font-weight:600">Add to Google Calendar</a>
            </p>
            <p style="font-size:12px;color:#6b7280">The time above was converted using your saved GIEFA time zone. The calendar link carries the exact UTC time and adjusts on your device.</p>
          </div>
        `,
        tags: [
          { name: "category", value: "meeting_invitation" },
          { name: "meeting_id", value: meeting.id.replaceAll("-", "_") },
        ],
      };
    });

    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `meeting-created-${meeting.id}-${chunkIndex}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    const result = (await response.json().catch(() => ({}))) as ResendBatchResponse;
    if (!response.ok) {
      throw new Error(
        result.error?.message || result.message || `Resend returned HTTP ${response.status}.`
      );
    }
    sent += chunk.length;
  }

  return sent;
}
