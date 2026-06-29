import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { supabaseServer } from "@/app/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ValuationSummary = {
  statement_date: string | null;
  period_start: string | null;
  period_end: string | null;
  reporting_month: string | null;
  net_asset_value: number | null;
  opening_balance: number | null;
  additional_investments: number | null;
  periodic_return: number | null;
  actual_after_tax_return: number | null;
  ytd_return_percent: number | null;
  closing_balance: number | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function parseSignedMoney(value: string | undefined) {
  if (!value) return null;
  const normalized = value.replace(/[^\d().-]/g, "");
  const negative = /^\(.+\)$/.test(normalized);
  const number = Number(normalized.replace(/[()]/g, ""));

  if (!Number.isFinite(number)) return null;

  return negative ? -number : number;
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const native = new Date(trimmed);

  if (!Number.isNaN(native.getTime())) {
    return native.toISOString().slice(0, 10);
  }

  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  const date = new Date(Number(fullYear), Number(month) - 1, Number(day));

  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function parseLongDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value.trim());

  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function firstNumberAfter(text: string, label: RegExp) {
  const match = text.match(label);
  return parseSignedMoney(match?.[1]);
}

function parseStandaloneAmountLine(value: string | undefined) {
  if (!value || !/^\(?[\d,]+(?:\.\d+)?\)?$/.test(value.trim())) return null;
  return parseSignedMoney(value);
}

function parsePdfPortfolioValues(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const targetIndex = lines.findIndex((line) =>
    /TARGET RETURN ON INVESTMENT/i.test(line)
  );
  const lessIndex = lines.findIndex((line) => /^5\.\s+LESS:/i.test(line));

  if (targetIndex === -1 || lessIndex === -1 || lessIndex <= targetIndex) {
    return null;
  }

  const values = lines
    .slice(targetIndex + 1, lessIndex)
    .map(parseStandaloneAmountLine)
    .filter((value): value is number => value !== null);

  if (values.length < 11) return null;

  return {
    net_asset_value: values[0],
    opening_balance: values[1],
    additional_investments: values[2],
    periodic_return: values[5],
    actual_after_tax_return: values[9],
    closing_balance: values[10],
  };
}

function parseValuationSummary(text: string): ValuationSummary {
  const normalized = text.replace(/\s+/g, " ");
  const periodMatch = normalized.match(
    /Valuation Period\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+To\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  const pdfPeriodStartMatch = normalized.match(
    /Valuation Period\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  const pdfPeriodEndMatch = normalized.match(
    /Customer Name[\s\S]*?\s(\d{1,2}\/\d{1,2}\/\d{4})\s+Branch/i
  );
  const statementDateMatch = normalized.match(
    /Statement Of Account As At\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i
  );
  const pdfValues = parsePdfPortfolioValues(text);
  const periodEnd = parseDate(periodMatch?.[2] ?? pdfPeriodEndMatch?.[1]);

  return {
    statement_date: parseLongDate(statementDateMatch?.[1]),
    period_start: parseDate(periodMatch?.[1] ?? pdfPeriodStartMatch?.[1]),
    period_end: periodEnd,
    reporting_month: periodEnd?.slice(0, 7) ?? null,
    net_asset_value:
      pdfValues?.net_asset_value ??
      firstNumberAfter(
        normalized,
        /NET ASSET VALUE OF PORTFOLIO \(NAV\)\s+([\d,]+(?:\.\d+)?)/i
      ),
    opening_balance:
      pdfValues?.opening_balance ??
      firstNumberAfter(normalized, /OPENING BALANCE\s+([\d,]+(?:\.\d+)?)/i),
    additional_investments:
      pdfValues?.additional_investments ??
      firstNumberAfter(
        normalized,
        /ADDITIONAL INVESTMENTS\/\(WITHDRAWALS\) \(NET\):\s+(\(?[\d,]+(?:\.\d+)?\)?)/i
      ),
    periodic_return:
      pdfValues?.periodic_return ??
      firstNumberAfter(
        normalized,
        /PERIODIC RETURN ON INVESTMENT\s+([\d,]+(?:\.\d+)?)/i
      ),
    actual_after_tax_return:
      pdfValues?.actual_after_tax_return ??
      firstNumberAfter(
        normalized,
        /ACTUAL AFTER TAX RETURN ON INVESTMENT \(AATR\)\s+([\d,]+(?:\.\d+)?)/i
      ),
    ytd_return_percent: firstNumberAfter(
      normalized,
      /YTD RETURN \(%\)\s+([\d,]+(?:\.\d+)?)/i
    ),
    closing_balance:
      pdfValues?.closing_balance ??
      firstNumberAfter(normalized, /CLOSING BALANCE\s+([\d,]+(?:\.\d+)?)/i),
  };
}

async function extractPdfText(file: File) {
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

async function fileToText(file: File) {
  if (isPdf(file)) return extractPdfText(file);
  if (/text|csv|plain|tab-separated/i.test(file.type) || /\.(csv|txt|tsv)$/i.test(file.name)) {
    return file.text();
  }

  throw new Error("Upload a PDF, CSV, TXT, or TSV statement file.");
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return jsonError("You must be signed in to extract a statement.", 401);
  }

  const { data: actor } = await supabase
    .from("members")
    .select("role, status")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<{ role: string; status: string }>();

  if (!actor || actor.status !== "approved" || !["treasurer", "admin"].includes(actor.role)) {
    return jsonError("Only treasurer or admin can extract finance statements.", 403);
  }

  const formData = await request.formData();
  const file = formData.get("statement_file");

  if (!(file instanceof File) || file.size === 0) {
    return jsonError("Upload a statement file before scanning.");
  }

  try {
    const text = await fileToText(file);
    const summary = parseValuationSummary(text);

    return NextResponse.json({
      file_name: file.name,
      text,
      summary,
      found_fields: Object.values(summary).filter(Boolean).length,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Statement extraction failed. Try another file or paste the text manually.",
      500
    );
  }
}
