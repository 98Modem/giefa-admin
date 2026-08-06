import { NextResponse } from "next/server";
import { sendDepositConfirmationEmail } from "@/app/lib/email/depositConfirmation";
import { supabaseServer } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

type MemberRole = "admin" | "chairman" | "treasurer" | "general_sec" | "member";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function maskSecret(value: string) {
  if (!value) return null;
  if (value.length <= 10) return `${value.slice(0, 2)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function envStatus(name: string, secret = false) {
  const value = env(name);

  return {
    name,
    present: Boolean(value),
    value: value ? (secret ? maskSecret(value) : value) : null,
  };
}

export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: member, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, role, status")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      role: MemberRole;
      status: string;
    }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (
    !member ||
    member.status !== "approved" ||
    member.role !== "admin"
  ) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const shouldSend = url.searchParams.get("send") === "1";

  const checks = [
    envStatus("RESEND_API_KEY", true),
    envStatus("GIEFA_EMAIL_FROM"),
    envStatus("GIEFA_EMAIL_REPLY_TO"),
    envStatus("SBG_DEPOSIT_CONFIRMATION_EMAIL"),
    envStatus("SBG_GROUP_ACCOUNT_NUMBER"),
    envStatus("SBG_GROUP_ACCOUNT_NAME"),
    envStatus("SBG_MONEY_MARKET_ACCOUNT_NUMBER"),
  ];

  const missing = checks
    .filter((check) => !check.present)
    .map((check) => check.name);

  let emailTest = null;

  if (shouldSend) {
    emailTest = await sendDepositConfirmationEmail({
      memberName:
        [member.first_name, member.last_name].filter(Boolean).join(" ") ||
        member.email ||
        "GIEFA Production Test",
      memberEmail: member.email ?? session.user.email ?? null,
      totalAmount: 1000,
      depositDate: new Date().toISOString().slice(0, 10),
      bankReference: "GIEFA-EMAIL-HEALTH-CHECK",
      senderName: "GIEFA Production Test",
      submissionIds: ["email-health-check"],
      attachments: [],
    });
  }

  return NextResponse.json({
    ok: missing.length === 0,
    checkedAt: new Date().toISOString(),
    access: {
      role: member.role,
      status: member.status,
    },
    environment: checks,
    missing,
    emailTest,
    nextStep: shouldSend
      ? "Check the Resend Emails/Logs page and the SBG_DEPOSIT_CONFIRMATION_EMAIL inbox."
      : "Append ?send=1 to this URL to send a live Resend test email.",
  });
}
