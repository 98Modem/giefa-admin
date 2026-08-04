type DepositConfirmationAttachment = {
  name: string;
  contentType: string;
  contentBase64: string;
};

type SendDepositConfirmationInput = {
  memberName: string;
  memberEmail: string | null;
  totalAmount: number;
  emergencyAmount: number;
  investmentAmount: number;
  contributionMonths: string[];
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
  const months = input.contributionMonths.join(", ");

  const text = [
    "Dear SBG Security Team,",
    "",
    "I have deposited money onto the Money Market Account as follows:",
    "",
    `Group Account Number: ${groupAccountNumber}`,
    `Group Account Name: ${groupAccountName}`,
    `Money Market Fund Account Number: ${moneyMarketAccount}`,
    `Reference number: ${reference}`,
    `Deposit date: ${input.depositDate}`,
    `Depositor / member: ${input.memberName}`,
    input.memberEmail ? `Member email: ${input.memberEmail}` : "",
    input.senderName && input.senderName !== input.memberName
      ? `Proof sender name: ${input.senderName}`
      : "",
    `Contribution month(s): ${months}`,
    `Total amount: UGX ${money(input.totalAmount)}`,
    `Emergency allocation: UGX ${money(input.emergencyAmount)}`,
    `Investment allocation: UGX ${money(input.investmentAmount)}`,
    "",
    "Deposit proof is attached for your confirmation and processing.",
    "",
    "Kind regards,",
    input.memberName,
  ].filter(Boolean);

  const html = text
    .map((line) =>
      line
        ? `<p style="margin:0 0 10px;color:#111827;font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${line}</p>`
        : `<div style="height:8px"></div>`
    )
    .join("");

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
