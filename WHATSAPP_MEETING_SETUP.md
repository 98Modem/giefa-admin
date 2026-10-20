# GIEFA WhatsApp meeting reminders

The application uses Meta WhatsApp Cloud API utility templates. Members must explicitly opt in on **My Meetings** before any reminder is queued.

The official Cloud API addresses individual WhatsApp users; it does not provide a supported group-recipient ID. After a meeting is created, the General Secretary gets a prefilled **Share to Prospects Saving Group** button. WhatsApp opens with the announcement ready, and the GS selects that group. Individual opted-in reminders remain automatic.

## 1. Install the database feature

Run `supabase-meetings-whatsapp.sql` once in the GIEFA Supabase SQL Editor.

## 2. Create the Meta template

In WhatsApp Manager, create and obtain approval for a utility template named `giefa_meeting_reminder` in `en_US` with this body and exactly five variables:

```text
Hello {{1}}, this is a reminder that {{2}} starts on {{3}}. Location: {{4}}. Meeting details and calendar options: {{5}}
```

The variables sent by the application are:

1. Member name
2. Meeting title
3. Meeting time formatted in that member's saved IANA time zone
4. Physical location or “Online meeting”
5. Authenticated GIEFA meeting details URL

## 3. Configure Vercel production secrets

Add these variables to the GIEFA Vercel project and redeploy:

```text
WHATSAPP_ACCESS_TOKEN=<permanent Meta system-user token>
WHATSAPP_PHONE_NUMBER_ID=<Cloud API phone number ID>
WHATSAPP_MEETING_REMINDER_TEMPLATE=giefa_meeting_reminder
WHATSAPP_TEMPLATE_LANGUAGE=en_US
WHATSAPP_GRAPH_API_VERSION=v26.0
```

`CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are also required. They already exist in the current GIEFA Vercel project.

## 4. Cron plan requirement

The production project is currently on Vercel Hobby, which permits only daily cron jobs. For that reason, `vercel.json` keeps the existing daily Supabase health check but does not register the meeting-reminder endpoint as a Vercel Cron Job. To deliver the one-week, one-day, and one-hour reminders accurately, upgrade to Vercel Pro or use Supabase Cron or another trusted scheduler to call the same endpoint every 15 minutes with:

```http
Authorization: Bearer <CRON_SECRET>
```

The endpoint claims each delivery atomically, records the Meta message ID, retries transient failures up to five times, and does not queue messages for opted-out members.

## 5. Registrar email invitations

Meeting creation also sends an individual invitation through Resend to every approved member with an email in the registrar. Each email formats the meeting time in that member's saved time zone and includes meeting and calendar links. Configure `RESEND_API_KEY`, `GIEFA_EMAIL_FROM`, and optionally `GIEFA_EMAIL_REPLY_TO`. The current production project already contains these variables.
