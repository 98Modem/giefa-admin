import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import {
  assertWhatsAppConfigured,
  MeetingReminderJob,
  sendMeetingReminder,
} from "@/app/lib/whatsapp/cloudApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertWhatsAppConfigured();
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "WhatsApp is not configured.",
      },
      { status: 503 }
    );
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("claim_due_meeting_reminders_v1", {
    p_batch_size: 50,
  });

  if (error) {
    console.error("meeting-reminders:claim-failed", { message: error.message });
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const jobs = (data ?? []) as MeetingReminderJob[];
  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        const providerMessageId = await sendMeetingReminder(job);
        const { error: updateError } = await admin
          .from("meeting_reminder_deliveries")
          .update({
            status: "sent",
            provider_message_id: providerMessageId,
            last_error: null,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.delivery_id);

        if (updateError) throw updateError;
        return { id: job.delivery_id, ok: true };
      } catch (sendError) {
        const message =
          sendError instanceof Error ? sendError.message : "Unknown WhatsApp error";
        console.error("meeting-reminders:send-failed", {
          deliveryId: job.delivery_id,
          message,
        });
        await admin
          .from("meeting_reminder_deliveries")
          .update({
            status: "failed",
            last_error: message.slice(0, 1000),
            scheduled_for: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.delivery_id);
        return { id: job.delivery_id, ok: false };
      }
    })
  );

  const sent = results.filter((result) => result.ok).length;
  const failed = results.length - sent;
  console.info("meeting-reminders:complete", { claimed: jobs.length, sent, failed });

  return Response.json({ ok: true, claimed: jobs.length, sent, failed });
}
