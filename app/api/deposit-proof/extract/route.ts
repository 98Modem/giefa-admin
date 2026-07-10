import { NextResponse } from "next/server";
import { supabaseServer } from "@/app/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

type PreparedProof = {
  name: string;
  type: string;
  base64Image?: string;
  text?: string;
};

type OpenAIExtractionInput = {
  images: Array<{ name: string; type: string; base64: string }>;
  textBlocks: Array<{ name: string; text: string }>;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message, extraction: EMPTY_EXTRACTION }, { status });
}

function allocateAmounts(amount: number | null) {
  if (!amount || amount <= 0) {
    return { emergency_amount: null, investment_amount: null };
  }

  const emergencyAmount = Math.round(amount * 0.3);
  return {
    emergency_amount: emergencyAmount,
    investment_amount: amount - emergencyAmount,
  };
}

function confidenceFromFields(foundFields: number, hasAmount: boolean, sourceCount = 1) {
  if (!hasAmount) return 0.35;

  const base =
    foundFields >= 4
      ? 0.96
      : foundFields === 3
        ? 0.86
        : foundFields === 2
          ? 0.72
          : 0.55;

  return Math.min(0.98, base + Math.min(0.02, (sourceCount - 1) * 0.01));
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

function cleanLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const knownDepositLabels = [
  /transaction\s+reference/i,
  /transaction\s+name/i,
  /transaction\s+date/i,
  /sender\s+name/i,
  /from\s+account\s+number/i,
  /debit\s+amount/i,
  /transaction\s+amount/i,
  /beneficiary\s+name/i,
  /purpose\s+of\s+transaction/i,
  /beneficiary\s+account\s+number/i,
  /target\s+currency/i,
  /beneficiary\s+bank\s+clearing\s+code/i,
  /bank\s+name/i,
  /narration/i,
  /fee/i,
  /reference|ref\.?|confirmation|receipt/i,
  /sender|from|paid\s+by/i,
  /amount|total|paid|sent|deposit|payment|ugx/i,
];

function isDepositLabel(line: string) {
  return knownDepositLabels.some((label) => label.test(line));
}

function extractInlineValue(line: string, label: RegExp) {
  const match = line.match(label);
  if (!match || match.index === undefined) return "";

  return line
    .slice(match.index + match[0].length)
    .replace(/^(\s*(no\.?|number|id|ugx))?\s*[:#-]?\s*/i, "")
    .trim();
}

function readDepositField(text: string, labels: RegExp[]) {
  const lines = cleanLines(text);
  const labelEntries = lines
    .map((line, index) => ({ line, index, label: labels.find((entry) => entry.test(line)) }))
    .filter((entry): entry is { line: string; index: number; label: RegExp } => Boolean(entry.label));

  for (const entry of labelEntries) {
    const inlineValue = extractInlineValue(entry.line, entry.label);
    if (inlineValue && !isDepositLabel(inlineValue)) return inlineValue;

    const nextLine = lines[entry.index + 1];
    if (nextLine && !isDepositLabel(nextLine)) return nextLine;
  }

  const allLabelEntries = lines
    .map((line, index) => ({ line, index }))
    .filter((entry) => isDepositLabel(entry.line));
  const allValues = lines.filter((line) => !isDepositLabel(line));

  if (allLabelEntries.length > 0 && allValues.length >= allLabelEntries.length) {
    const targetIndex = allLabelEntries.findIndex((entry) =>
      labels.some((label) => label.test(entry.line))
    );
    if (targetIndex >= 0) return allValues[targetIndex] || null;
  }

  return null;
}

function parseMoneyValue(value: string | null) {
  if (!value) return null;
  const matches = [...value.matchAll(/(?:UGX|Ugx|ugx)?\s*([0-9]{1,3}(?:[,.\s][0-9]{3})+|[0-9]{4,})(?:\.\d{1,2})?/g)];
  const candidates = matches
    .map((match) => Number(match[1].replace(/[,\s]/g, "")))
    .filter((amount) => Number.isFinite(amount) && amount >= 1000);

  return candidates[0] ?? null;
}

function parseAmount(text: string) {
  const preferredAmount =
    parseMoneyValue(readDepositField(text, [/transaction\s+amount/i])) ??
    parseMoneyValue(readDepositField(text, [/debit\s+amount/i]));

  if (preferredAmount) return preferredAmount;

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
  const fieldDate = readDepositField(text, [/transaction\s+date/i, /deposit\s+date/i, /date/i]);
  const dateSource = fieldDate ? `${fieldDate}\n${text}` : text;
  const numericDate = dateSource.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (numericDate) {
    const [, year, month, day] = numericDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const ugandaNumericDate = dateSource.match(/\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (ugandaNumericDate) {
    const [, day, month, year] = ugandaNumericDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const dayMonthYear = dateSource.match(
    /\b(0?[1-9]|[12]\d|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*,?\s+(20\d{2})\b/i
  );
  if (dayMonthYear) {
    return toIsoDate(new Date(`${dayMonthYear[1]} ${dayMonthYear[2]} ${dayMonthYear[3]}`));
  }

  const monthDayYear = dateSource.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(0?[1-9]|[12]\d|3[01]),?\s+(20\d{2})\b/i
  );
  if (monthDayYear) {
    return toIsoDate(new Date(`${monthDayYear[1]} ${monthDayYear[2]} ${monthDayYear[3]}`));
  }

  return null;
}

function parseReference(text: string) {
  const fieldReference = readDepositField(text, [
    /transaction\s+reference/i,
    /reference\s*(no\.?|number|id)?/i,
    /confirmation\s*(no\.?|number|id)?/i,
    /receipt\s*(no\.?|number|id)?/i,
  ]);
  if (fieldReference && !isDepositLabel(fieldReference)) return fieldReference;

  const line = text
    .split(/\r?\n/)
    .find((entry) => /(reference|ref\.?|confirmation|receipt)/i.test(entry));
  if (!line) return null;

  return (
    line
      .replace(/^(transaction\s+reference|reference|ref\.?|transaction|confirmation|receipt)(\s*(no\.?|number|id))?\s*[:#-]?\s*/i, "")
      .trim() || line.trim()
  );
}

function parseSenderName(text: string) {
  const fieldSender = readDepositField(text, [/sender\s+name/i, /^sender\b/i, /^paid\s+by\b/i]);
  if (fieldSender && !isDepositLabel(fieldSender) && fieldSender.length <= 80) {
    return fieldSender;
  }

  const lines = cleanLines(text);
  const senderIndex = lines.findIndex((line) => /(sender|from|paid by)/i.test(line));
  const senderLine = senderIndex >= 0 ? lines[senderIndex] : "";
  const directCandidate = senderLine
    .replace(/^(sender\s+name|sender|from|paid by)\s*[:#-]?\s*/i, "")
    .trim();
  const candidate =
    directCandidate && directCandidate !== senderLine ? directCandidate : senderIndex >= 0 ? lines[senderIndex + 1] : lines[0];

  if (!candidate || /recipient|payment|details|bank|reference|amount|submitted|account number/i.test(candidate)) {
    return null;
  }

  return candidate.length > 80 ? null : candidate;
}

function parseGoogleVisionExtraction(text: string, sourceCount = 1): DepositExtraction {
  const amount = parseAmount(text);
  const depositDate = parseDate(text);
  const contributionMonth = depositDate ? depositDate.slice(0, 7) : null;
  const bankReference = parseReference(text);
  const senderName = parseSenderName(text);
  const foundFields = [amount, depositDate, bankReference, senderName].filter(Boolean).length;
  const confidence = confidenceFromFields(foundFields, Boolean(amount), sourceCount);
  const allocation = allocateAmounts(amount);

  return {
    amount,
    deposit_date: depositDate,
    contribution_month: contributionMonth,
    bank_reference: bankReference,
    sender_name: senderName,
    ...allocation,
    confidence,
    needs_review: foundFields < 4,
    notes: `OCR extracted these suggestions from ${sourceCount} proof file${sourceCount === 1 ? "" : "s"}. Review before submitting.\n\nExtracted text:\n${text.slice(0, 1800)}`,
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
  const normalizedAmount = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
  const allocation = allocateAmounts(normalizedAmount);

  return {
    amount: normalizedAmount,
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
        : allocation.emergency_amount,
    investment_amount:
      Number.isFinite(investmentAmount) && investmentAmount >= 0
        ? Math.round(investmentAmount)
        : allocation.investment_amount,
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

async function extractWithOpenAI(input: OpenAIExtractionInput) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return jsonError(
      "OPENAI_API_KEY is not configured. Add it to .env.local to enable OpenAI extraction.",
      503
    );
  }

  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string }
  > = [
    {
      type: "input_text",
      text:
        "Extract deposit proof details for a Ugandan savings association. The user may upload one or more screenshots, PDFs, or text files for the same deposit evidence. Use the clearest value across all files. Read Ugandan date formats such as DD/MM/YYYY. Return ISO date format YYYY-MM-DD. Use contribution_month as YYYY-MM when a month is visible or can be derived from the deposit date. Amounts must be numeric UGX values without commas. Default emergency_amount to exactly 30% of the total amount, rounded to the nearest UGX, and investment_amount to the remaining balance unless the proof explicitly shows a different association-approved split. Be confident when amount, date, reference, and sender are readable; mark needs_review true when any critical field is missing or uncertain. Return concise notes explaining what was read.",
    },
  ];

  input.textBlocks.forEach((block) => {
    content.push({
      type: "input_text",
      text: `Text extracted from ${block.name}:\n${block.text.slice(0, 6000)}`,
    });
  });

  input.images.forEach((image) => {
    content.push({
      type: "input_image",
      image_url: `data:${image.type};base64,${image.base64}`,
    });
  });

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
          content,
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

async function extractGoogleVisionTextFromImage(base64Image: string) {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_CLOUD_VISION_API_KEY is not configured. Add it to .env.local to enable Google Vision OCR.");
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
    throw new Error(friendlyGoogleVisionError(result, response.status));
  }

  const text = extractGoogleVisionText(result);

  if (!text) {
    throw new Error("Google Vision did not find readable text in this image. Try a clearer screenshot or enter the details manually.");
  }

  return text;
}

async function extractWithGoogleVision(input: OpenAIExtractionInput) {
  const textBlocks = [...input.textBlocks];

  for (const image of input.images) {
    textBlocks.push({
      name: image.name,
      text: await extractGoogleVisionTextFromImage(image.base64),
    });
  }

  const combinedText = textBlocks.map((block) => `--- ${block.name} ---\n${block.text}`).join("\n\n");

  if (!combinedText.trim()) {
    return jsonError(
      "Google Vision did not find readable text. Try a clearer screenshot or enter the details manually.",
      422
    );
  }

  return NextResponse.json({ extraction: parseGoogleVisionExtraction(combinedText, textBlocks.length) });
}

async function extractPdfText(file: File): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({
    data: Buffer.from(await file.arrayBuffer()),
  });

  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

async function prepareProof(file: File): Promise<PreparedProof> {
  if (file.type.startsWith("image/")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    return {
      name: file.name,
      type: file.type,
      base64Image: buffer.toString("base64"),
    };
  }

  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return {
      name: file.name,
      type: file.type || "application/pdf",
      text: await extractPdfText(file),
    };
  }

  if (file.type === "text/plain" || /\.txt$/i.test(file.name)) {
    return {
      name: file.name,
      type: file.type || "text/plain",
      text: (await file.text()).trim(),
    };
  }

  throw new Error("Only images, PDFs, and text files can be scanned.");
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
  const proofEntries = formData.getAll("proofs");
  const legacyProof = formData.get("proof");
  const proofs = [
    ...proofEntries,
    ...(proofEntries.length === 0 && legacyProof ? [legacyProof] : []),
  ].filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!proofs.length) {
    return jsonError("Upload at least one deposit proof file before scanning.");
  }

  if (proofs.length > 6) {
    return jsonError("Upload up to 6 proof files at a time.");
  }

  if (proofs.some((proof) => proof.size > 8 * 1024 * 1024)) {
    return jsonError("Each proof file must be 8MB or smaller.");
  }

  const preparedProofs = await Promise.all(proofs.map((proof) => prepareProof(proof)));
  const extractionInput: OpenAIExtractionInput = {
    images: preparedProofs
      .filter((proof) => proof.base64Image)
      .map((proof) => ({
        name: proof.name,
        type: proof.type,
        base64: proof.base64Image as string,
      })),
    textBlocks: preparedProofs
      .filter((proof) => proof.text)
      .map((proof) => ({
        name: proof.name,
        text: proof.text as string,
      })),
  };

  if (!extractionInput.images.length && !extractionInput.textBlocks.some((block) => block.text)) {
    return jsonError("No readable text was found in the uploaded proof files.", 422);
  }

  const provider = process.env.GIEFA_OCR_PROVIDER || "openai";

  try {
    if (provider === "google-vision") {
      return extractWithGoogleVision(extractionInput);
    }

    return extractWithOpenAI(extractionInput);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "AI extraction failed.", 502);
  }
}
