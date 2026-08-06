type DepositConfirmationAttachment = {
  name: string;
  contentType: string;
  contentBase64: string;
};

type SendDepositConfirmationInput = {
  memberName: string;
  memberEmail: string | null;
  totalAmount: number;
  depositDate: string;
  bankReference: string | null;
  senderName: string | null;
  submissionIds: string[];
  attachments: DepositConfirmationAttachment[];
};

export type DepositConfirmationEmailResult = {
  status: "sent" | "skipped" | "failed";
  message: string;
};

const resendEndpoint = "https://api.resend.com/emails";

function money(value: number) {
  return new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildBody(input: SendDepositConfirmationInput) {
  const groupAccountNumber = env("SBG_GROUP_ACCOUNT_NUMBER") || "0000013863";
  const groupAccountName =
    env("SBG_GROUP_ACCOUNT_NAME") ||
    "MUGEMA TOM, BAMWINE ANDREW JORDAN, AND AGABA HENRY - PROSPECTIVE SAVING GROUP";
  const moneyMarketAccount =
    env("SBG_MONEY_MARKET_ACCOUNT_NUMBER") || "9030020680163";
  const reference =
    input.bankReference ||
    input.submissionIds[0] ||
    `GIEFA-${input.depositDate}-${input.memberName.replace(/\s+/g, "-")}`;
  const accountDetails = [
    ["Group Account Number", groupAccountNumber],
    ["Group Account Name", groupAccountName],
    ["Money Market Fund Account Number", moneyMarketAccount],
  ];
  const depositDetails = [
    ["Reference number", reference],
    ["Deposit date", input.depositDate],
    ["Total amount deposited", `UGX ${money(input.totalAmount)}`],
    ["Depositor / member", input.memberName],
    ...(input.memberEmail ? [["Member email", input.memberEmail]] : []),
    ...(input.senderName && input.senderName !== input.memberName
      ? [["Proof sender name", input.senderName]]
      : []),
  ];

  const text = [
    "Dear SBG Security Team,",
    "",
    "I have deposited money onto the Money Market Account as follows:",
    "",
    "Account details",
    ...accountDetails.map(([label, value]) => `- ${label}: ${value}`),
    "",
    "Deposit details",
    ...depositDetails.map(([label, value]) => `- ${label}: ${value}`),
    "",
    "Deposit proof is attached for your confirmation and processing.",
    "",
    "Kind regards,",
    input.memberName,
  ].filter(Boolean);

  const detailRows = (rows: string[][]) =>
    rows
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563;font-size:13px;width:38%;vertical-align:top">${escapeHtml(label)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;font-weight:600;vertical-align:top">${escapeHtml(value)}</td>
          </tr>`
      )
      .join("");

  const section = (title: string, rows: string[][]) => `
    <div style="margin:18px 0 0">
      <h2 style="margin:0 0 8px;color:#111827;font-family:Arial,sans-serif;font-size:15px;line-height:1.4">${escapeHtml(title)}</h2>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#ffffff;font-family:Arial,sans-serif">
        ${detailRows(rows)}
      </table>
    </div>`;

  const html = `
    <div style="margin:0;padding:0;background:#ffffff">
      <div style="max-width:680px;margin:0;padding:6px 0 0;font-family:Arial,sans-serif;color:#111827">
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6">Dear SBG Security Team,</p>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6">I have deposited money onto the Money Market Account as follows:</p>
        ${section("Account details", accountDetails)}
        ${section("Deposit details", depositDetails)}
        <p style="margin:18px 0 12px;font-size:14px;line-height:1.6">Deposit proof is attached for your confirmation and processing.</p>
        <p style="margin:0 0 4px;font-size:14px;line-height:1.6">Kind regards,</p>
        <p style="margin:0;font-size:14px;line-height:1.6;font-weight:600">${escapeHtml(input.memberName)}</p>
      </div>
    </div>`;

  return { text: text.join("\n"), html };
}

export async function buildDepositConfirmationAttachments(files: File[]) {
  const attachments: DepositConfirmationAttachment[] = [];

  for (const file of files.slice(0, 4)) {
    if (file.size > 7 * 1024 * 1024) continue;

    const buffer = Buffer.from(await file.arrayBuffer());
    attachments.push({
      name: file.name || "deposit-proof",
      contentType: file.type || "application/octet-stream",
      contentBase64: buffer.toString("base64"),
    });
  }

  return attachments;
}

export async function sendDepositConfirmationEmail(
  input: SendDepositConfirmationInput
): Promise<DepositConfirmationEmailResult> {
  const apiKey = env("RESEND_API_KEY");
  const to = env("SBG_DEPOSIT_CONFIRMATION_EMAIL");
  const from = env("GIEFA_EMAIL_FROM") || "GIEFA Deposits <onboarding@resend.dev>";
  const replyTo = env("GIEFA_EMAIL_REPLY_TO") || input.memberEmail || undefined;

  if (!apiKey || !to) {
    return {
      status: "skipped",
      message:
        "SBG confirmation email skipped because RESEND_API_KEY or SBG_DEPOSIT_CONFIRMATION_EMAIL is not configured.",
    };
  }

  const { text, html } = buildBody(input);

  const response = await fetch(resendEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo ? [replyTo] : undefined,
      subject: "Confirmation of Deposit - Money Market Account",
      text,
      html,
      attachments: input.attachments.map((attachment) => ({
        filename: attachment.name,
        content: attachment.contentBase64,
        content_type: attachment.contentType,
      })),
      tags: [{ name: "workflow", value: "deposit-confirmation" }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      status: "failed",
      message: `SBG confirmation email failed: ${errorText.slice(0, 240)}`,
    };
  }

  return {
    status: "sent",
    message: `SBG confirmation email sent to ${to}.`,
  };
}
