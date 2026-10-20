"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/app/lib/supabase/server";
import { sendMeetingInvitationEmails } from "@/app/lib/email/meetingInvitations";

export type MeetingActionState = {
  ok: boolean;
  message: string;
  meetingId?: string;
  whatsappShareUrl?: string;
};

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export async function scheduleMeetingAction(
  _previousState: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const title = textValue(formData, "title");
  const startsAtValue = textValue(formData, "starts_at_utc");
  const sourceTimeZone = textValue(formData, "source_time_zone") || "UTC";
  const durationMinutes = Number(textValue(formData, "duration_minutes"));
  const reminderMinutes = formData
    .getAll("reminder_minutes")
    .map(Number)
    .filter((value) => [15, 60, 1440, 10080].includes(value));
  const startsAt = new Date(startsAtValue);
  const meetingUrl = textValue(formData, "meeting_url");

  if (title.length < 3 || title.length > 160) {
    return {
      ok: false,
      message: "Enter a meeting title between 3 and 160 characters.",
    };
  }
  if (!Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) {
    return { ok: false, message: "Choose a future meeting date and time." };
  }
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 15 ||
    durationMinutes > 720
  ) {
    return {
      ok: false,
      message: "Choose a duration between 15 minutes and 12 hours.",
    };
  }
  if (!validTimeZone(sourceTimeZone)) {
    return {
      ok: false,
      message: "The detected time zone is not valid. Refresh and try again.",
    };
  }
  if (meetingUrl) {
    try {
      const parsed = new URL(meetingUrl);
      if (!["http:", "https:"].includes(parsed.protocol))
        throw new Error("invalid protocol");
    } catch {
      return {
        ok: false,
        message: "Meeting link must be a complete http or https URL.",
      };
    }
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("schedule_meeting_v1", {
    p_title: title,
    p_meeting_type: textValue(formData, "meeting_type") || "general_assembly",
    p_description: textValue(formData, "description"),
    p_location: textValue(formData, "location"),
    p_meeting_url: meetingUrl,
    p_starts_at: startsAt.toISOString(),
    p_duration_minutes: durationMinutes,
    p_source_time_zone: sourceTimeZone,
    p_reminder_minutes: reminderMinutes.length
      ? reminderMinutes
      : [10080, 1440, 60],
    p_whatsapp_enabled: formData.get("whatsapp_enabled") === "on",
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const meetingId = typeof data === "string" ? data : undefined;
  let emailMessage = "";
  if (meetingId) {
    const { data: recipients, error: recipientError } = await supabase
      .from("members")
      .select("first_name, last_name, email, time_zone")
      .eq("status", "approved")
      .not("email", "is", null);

    try {
      if (recipientError) throw recipientError;
      const emailCount = await sendMeetingInvitationEmails(
        {
          id: meetingId,
          title,
          description: textValue(formData, "description"),
          location: textValue(formData, "location"),
          meetingUrl,
          startsAt: startsAt.toISOString(),
          endsAt: new Date(
            startsAt.getTime() + durationMinutes * 60_000,
          ).toISOString(),
        },
        recipients ?? [],
      );
      emailMessage = ` Email invitations sent to ${emailCount} registered member${emailCount === 1 ? "" : "s"}.`;
    } catch (emailError) {
      console.error("meeting-invitations:send-failed", {
        meetingId,
        message:
          emailError instanceof Error
            ? emailError.message
            : "Unknown email error",
      });
      emailMessage =
        " The meeting was saved, but member email delivery needs attention.";
    }
  }

  revalidatePath("/members/meetings");
  revalidatePath("/meetings");

  return {
    ok: true,
    message: `Meeting scheduled. Members can now see it in their local time zone.${emailMessage}`,
    meetingId,
    whatsappShareUrl: meetingId
      ? `https://wa.me/?text=${encodeURIComponent(
          [
            "Prospects Saving Group — new GIEFA meeting",
            title,
            `Time: ${new Intl.DateTimeFormat("en-US", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: sourceTimeZone,
            }).format(startsAt)} (${sourceTimeZone})`,
            meetingUrl || textValue(formData, "location"),
            `${process.env.NEXT_PUBLIC_SITE_URL || "https://giefa.org"}/meetings/${meetingId}`,
          ]
            .filter(Boolean)
            .join("\n"),
        )}`
      : undefined,
  };
}

export async function cancelMeetingAction(formData: FormData) {
  const meetingId = textValue(formData, "meeting_id");
  if (!meetingId) return;

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("cancel_meeting_v1", {
    p_meeting_id: meetingId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/members/meetings");
  revalidatePath("/meetings");
  revalidatePath(`/meetings/${meetingId}`);
}

export async function saveReminderPreferencesAction(
  _previousState: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const phone = textValue(formData, "phone_e164");
  const timeZone = textValue(formData, "time_zone") || "UTC";
  const optedIn = formData.get("whatsapp_opt_in") === "on";

  if (!validTimeZone(timeZone)) {
    return { ok: false, message: "The detected time zone is not valid." };
  }
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone.replace(/[\s()-]/g, ""))) {
    return {
      ok: false,
      message: "Use international E.164 format, for example +14165550123.",
    };
  }
  if (optedIn && !phone) {
    return {
      ok: false,
      message: "Add your WhatsApp number before enabling reminders.",
    };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc(
    "update_meeting_communication_preferences_v1",
    {
      p_phone_e164: phone.replace(/[\s()-]/g, ""),
      p_time_zone: timeZone,
      p_whatsapp_opt_in: optedIn,
    },
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/meetings");
  return {
    ok: true,
    message: optedIn
      ? "WhatsApp reminders are enabled for your number."
      : "Your meeting time zone was saved and WhatsApp reminders are off.",
  };
}
