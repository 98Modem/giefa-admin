import { NextResponse } from "next/server";
import { supabaseServer } from "@/app/lib/supabase/server";

type DepositExtraction = {
  amount: number | null;
  deposit_date: string | null;
  contribution_month: string | null;
  bank_reference: string | null;
  sender_name: string | null;
  emergency_amount: number | null;
  investment_amount: number | null;
  confidence: number;
  needs_review: boolean;
  notes: string;
};

const EMPTY_EXTRACTION: DepositExtraction = {
  amount: null,
  deposit_date: null,
  contribution_month: null,
  bank_reference: null,
  sender_name: null,
  emergency_amount: null,
  investment_amount: null,
  confidence: 0,
  needs_review: true,
  notes: "No extraction has been performed.",
};

type GoogleVisionResult = {
  responses?: Array<{
    textAnnotations?: Array<{ description?: string }>;
    fullTextAnnotation?: { text?: string };
    error?: { message?: string; code?: number };
  }>;
  error?: { message?: string; code?: number };
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message, extraction: EMPTY_EXTRACTION }, { status });
}

function getErrorMessage(result: unknown) {
  return result &&
    typeof result === "object" &&
    "error" in result &&
    result.error &&
    typeof result.error === "object" &&
    "message" in result.error &&
    typeof result.error.message === "string"
    ? result.error.message
    : "";
}

function friendlyOpenAIError(result: unknown, status: number) {
  const message = getErrorMessage(result);
  const code =
    result &&
    typeof result === "object" &&
    "error" in result &&
    result.error &&
    typeof result.error === "object" &&
    "code" in result.error &&
    typeof result.error.code === "string"
      ? result.error.code
      : "";

  if (status === 429 && (code === "insufficient_quota" || message.toLowerCase().includes("quota"))) {
    return "AI scanning is paused because the OpenAI account has no available quota or billing credit. You can still enter the deposit details manually and send them to finance.";
  }

  if (status === 401) {
    return "AI scanning could not authenticate. Check that OPENAI_API_KEY is correct in .env.local, then restart the app.";
  }

  if (status === 429) {
    return "AI scanning is temporarily rate limited. Please try again shortly, or enter the deposit details manually.";
  }

  return message || "AI extraction failed. You can still enter the details manually.";
}

function friendlyGoogleVisionError(result: unknown, status: number) {
  const googleResult = result as GoogleVisionResult;
  const responseError = googleResult.responses?.find((response) => response.error)?.error?.message;
  const message = responseError || getErrorMessage(result);

  if (status === 400 && message.toLowerCase().includes("api key")) {
    return "Google Vision could not use this API key. Check GOOGLE_CLOUD_VISION_API_KEY in .env.local and make sure the key is restricted to Cloud Vision API.";
  }

  if (status === 403 || message.toLowerCase().includes("disabled")) {
    return "Google Vision is not enabled or allowed for this project. Enable Cloud Vision API for the Google Cloud project, then restart the app.";
  }

  if (status === 429 || message.toLowerCase().includes("quota")) {
    return "Google Vision OCR is temporarily unavailable because the project reached quota or billing is not active. You can still enter details manually.";
  }

  return message || "Google Vision OCR failed. You can still enter the details manually.";
}

function extractOutputText(response: unknown) {
  if (
    response &&
    typeof response === "object" &&
    "output_text" in response &&
    typeof response.output_text === "string"
  ) {
    return response.output_text;
  }

  if (!response || typeof response !== "object" || !("output" in response)) {
    return "";
  }

  const output = response.output;
  if (!Array.isArray(output)) return "";

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !("content" in item)) return [];
      const content = item.content;
      if (!Array.isArray(content)) return [];

      return content.map((part) => {
        if (!part || typeof part !== "object" || !("text" in part)) return "";
        return typeof part.text === "string" ? part.text : "";
      });
    })
    .join("\n")
    .trim();
}

function extractGoogleVisionText(result: GoogleVisionResult) {
  const response = result.responses?.[0];
  return (
    response?.fullTextAnnotation?.text ||
    response?.textAnnotations?.[0]?.description ||
    ""
  ).trim();
}

function parseAmount(text: string) {
  const amountLines = text
    .split(/\r?\n/)
    .filter((line) => /(amount|total|paid|sent|deposit|payment|ugx)/i.test(line));
  const source = amountLines.length > 0 ? amountLines.join("\n") : text;
  const candidates = [...source.matchAll(/(?:UGX|Ugx|ugx)?\s*([0-9]{1,3}(?:[,.\s][0-9]{3})+|[0-9]{4,})/g)]
    .map((match) => Number(match[1].replace(/[,\s.]/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 1000);

  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function toIsoDate(value: Date) {
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

function parseDate(text: string) {
  const numericDate = text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (numericDate) {
    const [, year, month, day] = numericDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const dayMonthYear = text.match(
    /\b(0?[1-9]|[12]\d|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*,?\s+(20\d{2})\b/i
  );
  if (dayMonthYear) {
    return toIsoDate(new Date(`${dayMonthYear[1]} ${dayMonthYear[2]} ${dayMonthYear[3]}`));
  }

  const monthDayYear = text.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(0?[1-9]|[12]\d|3[01]),?\s+(20\d{2})\b/i
  );
  if (monthDayYear) {
    return toIsoDate(new Date(`${monthDayYear[1]} ${monthDayYear[2]} ${monthDayYear[3]}`));
  }

  return null;
}

function parseReference(text: string) {
  const line = text
    .split(/\r?\n/)
    .find((entry) => /(reference|ref\.?|transaction|confirmation|receipt)/i.test(entry));
  if (!line) return null;

  return (
    line
      .replace(/^(reference|ref\.?|transaction|confirmation|receipt)(\s*(no\.?|number|id))?\s*[:#-]?\s*/i, "")
      .trim() || line.trim()
  );
}

function parseSenderName(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const senderIndex = lines.findIndex((line) => /(sender|from|paid by)/i.test(line));
  const candidate = senderIndex >= 0 ? lines[senderIndex + 1] : lines[0];

  if (!candidate || /recipient|payment|details|bank|reference|amount|submitted/i.test(candidate)) {
    return null;
  }

  return candidate.length > 80 ? null : candidate;
}

function parseGoogleVisionExtraction(text: string): DepositExtraction {
  const amount = parseAmount(text);
  const depositDate = parseDate(text);
  const contributionMonth = depositDate ? depositDate.slice(0, 7) : null;
  const bankReference = parseReference(text);
  const senderName = parseSenderName(text);
  const foundFields = [amount, depositDate, bankReference, senderName].filter(Boolean).length;
  const confidence = Math.min(0.92, Math.max(0.25, foundFields / 4));

  return {
    amount,
    deposit_date: depositDate,
    contribution_month: contributionMonth,
    bank_reference: bankReference,
    sender_name: senderName,
    emergency_amount: 0,
    investment_amount: amount,
    confidence,
    needs_review: true,
    notes: `Google Vision OCR extracted these suggestions. Review before submitting.\n\nOCR text:\n${text.slice(0, 1200)}`,
  };
}

function normalizeExtraction(value: unknown): DepositExtraction {
  if (!value || typeof value !== "object") {
    return EMPTY_EXTRACTION;
  }

  const record = value as Record<string, unknown>;
  const amount = Number(record.amount);
  const emergencyAmount = Number(record.emergency_amount);
  const investmentAmount = Number(record.investment_amount);
  const confidence = Number(record.confidence);

  return {
    amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null,
    deposit_date:
      typeof record.deposit_date === "string" && record.deposit_date
        ? record.deposit_date
        : null,
    contribution_month:
      typeof record.contribution_month === "string" && record.contribution_month
        ? record.contribution_month
        : null,
    bank_reference:
      typeof record.bank_reference === "string" && record.bank_reference
        ? record.bank_reference
        : null,
    sender_name:
      typeof record.sender_name === "string" && record.sender_name
        ? record.sender_name
        : null,
    emergency_amount:
      Number.isFinite(emergencyAmount) && emergencyAmount >= 0
        ? Math.round(emergencyAmount)
        : null,
    investment_amount:
      Number.isFinite(investmentAmount) && investmentAmount >= 0
        ? Math.round(investmentAmount)
        : null,
    confidence:
      Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
        ? confidence
        : 0,
    needs_review: Boolean(record.needs_review ?? true),
    notes:
      typeof record.notes === "string" && record.notes
        ? record.notes
        : "Review the extracted fields before submitting.",
  };
}

async function extractWithOpenAI(imageUrl: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return jsonError(
      "OPENAI_API_KEY is not configured. Add it to .env.local to enable OpenAI extraction.",
      503
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_DEPOSIT_EXTRACTION_MODEL || "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Extract deposit proof details for a Ugandan savings association. Return only fields visible or strongly implied by the image. Use ISO date format YYYY-MM-DD. Use contribution_month as YYYY-MM when a month is visible or can be derived from the deposit date. Amounts must be numeric UGX values without commas. If the split is not visible, set emergency_amount to 0 and investment_amount to the total amount. Mark needs_review true unless every critical field is clear.",
            },
            {
              type: "input_image",
              image_url: imageUrl,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "deposit_proof_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              amount: { type: ["number", "null"] },
              deposit_date: { type: ["string", "null"] },
              contribution_month: { type: ["string", "null"] },
              bank_reference: { type: ["string", "null"] },
              sender_name: { type: ["string", "null"] },
              emergency_amount: { type: ["number", "null"] },
              investment_amount: { type: ["number", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              needs_review: { type: "boolean" },
              notes: { type: "string" },
            },
            required: [
              "amount",
              "deposit_date",
              "contribution_month",
              "bank_reference",
              "sender_name",
              "emergency_amount",
              "investment_amount",
              "confidence",
              "needs_review",
              "notes",
            ],
          },
        },
      },
      max_output_tokens: 800,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    return jsonError(friendlyOpenAIError(result, response.status), response.status);
  }

  const outputText = extractOutputText(result);

  try {
    const extraction = normalizeExtraction(JSON.parse(outputText));
    return NextResponse.json({ extraction });
  } catch {
    return jsonError("AI returned an unreadable result. Please enter the details manually.", 502);
  }
}

async function extractWithGoogleVision(base64Image: string) {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

  if (!apiKey) {
    return jsonError(
      "GOOGLE_CLOUD_VISION_API_KEY is not configured. Add it to .env.local to enable Google Vision OCR.",
      503
    );
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
          },
        ],
      }),
    }
  );

  const result = (await response.json()) as GoogleVisionResult;

  if (!response.ok || result.responses?.[0]?.error) {
    return jsonError(friendlyGoogleVisionError(result, response.status), response.status);
  }

  const text = extractGoogleVisionText(result);

  if (!text) {
    return jsonError(
      "Google Vision did not find readable text in this image. Try a clearer screenshot or enter the details manually.",
      422
    );
  }

  return NextResponse.json({ extraction: parseGoogleVisionExtraction(text) });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return jsonError("You must be signed in to scan a deposit proof.", 401);
  }

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("auth_user_id", session.user.id)
    .eq("status", "approved")
    .maybeSingle<{ id: string }>();

  if (!member) {
    return jsonError("Only approved members can scan deposit proof.", 403);
  }

  const formData = await request.formData();
  const proof = formData.get("proof");

  if (!(proof instanceof File) || proof.size === 0) {
    return jsonError("Upload a deposit proof image before scanning.");
  }

  if (!proof.type.startsWith("image/")) {
    return jsonError("The proof must be an image file.");
  }

  if (proof.size > 5 * 1024 * 1024) {
    return jsonError("The proof image must be 5MB or smaller.");
  }

  const buffer = Buffer.from(await proof.arrayBuffer());
  const base64Image = buffer.toString("base64");
  const provider = process.env.GIEFA_OCR_PROVIDER || "openai";

  if (provider === "google-vision") {
    return extractWithGoogleVision(base64Image);
  }

  const imageUrl = `data:${proof.type};base64,${base64Image}`;
  return extractWithOpenAI(imageUrl);
}
