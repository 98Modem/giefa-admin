"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/app/lib/supabase/server";

type StatementTransaction = {
  transaction_date: string | null;
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  running_balance: number | null;
  matched_submission_id: string | null;
  match_status: "exact" | "possible" | "unmatched";
};

type ApprovedSubmission = {
  id: string;
  amount: number | null;
  deposit_date: string | null;
  bank_reference: string | null;
  sender_name: string | null;
  member_id: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const raw = getString(formData, key).replace(/,/g, "");
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function assertOk(error: { message: string } | null, action: string) {
  if (error) {
    throw new Error(`${action} failed: ${error.message}`);
  }
}

function isUploadableStatement(file: FormDataEntryValue | null): file is File {
  return file instanceof File && file.size > 0;
}

function normalizeReference(value: string | null | undefined) {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function parseMoney(value: string | undefined) {
  if (!value) return 0;
  const normalized = value.replace(/[^\d.-]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.abs(number) : 0;
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

function splitStatementLine(line: string) {
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim());
  if (line.includes(",")) return line.split(",").map((cell) => cell.trim());
  return line.split(/\s{2,}/).map((cell) => cell.trim());
}

function readStatementAmounts(cells: string[]) {
  const numericTail = cells.slice(2).map(parseMoney).filter((value) => value > 0);

  if (numericTail.length >= 3) {
    return {
      debit: numericTail[numericTail.length - 3] ?? 0,
      credit: numericTail[numericTail.length - 2] ?? 0,
      runningBalance: numericTail[numericTail.length - 1] ?? null,
    };
  }

  if (numericTail.length === 2) {
    return {
      debit: 0,
      credit: numericTail[0],
      runningBalance: numericTail[1],
    };
  }

  return {
    debit: 0,
    credit: numericTail[0] ?? 0,
    runningBalance: null,
  };
}

function parseStatementText(text: string): StatementTransaction[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitStatementLine)
    .filter((cells) => cells.length >= 3)
    .filter((cells) => !/date|description|narration|balance/i.test(cells.join(" ")))
    .map((cells) => {
      const transactionDate = parseDate(cells[0]);
      const amounts = readStatementAmounts(cells);
      const referenceCell =
        cells.find((cell) => /ref|id|txn|ft|r\d{4,}/i.test(cell)) ?? null;

      return {
        transaction_date: transactionDate,
        description: cells.slice(1, Math.max(cells.length - 2, 2)).join(" ") || cells.join(" "),
        reference: referenceCell,
        debit: amounts.debit,
        credit: amounts.credit,
        running_balance: amounts.runningBalance,
        matched_submission_id: null,
        match_status: "unmatched" as const,
      };
    })
    .filter((row) => row.credit > 0);
}

function applyMatches(
  transactions: StatementTransaction[],
  approvedSubmissions: ApprovedSubmission[]
) {
  const used = new Set<string>();

  return transactions.map((transaction) => {
    const transactionReference = normalizeReference(transaction.reference || transaction.description);
    const exact = approvedSubmissions.find((submission) => {
      if (used.has(submission.id)) return false;
      const submissionReference = normalizeReference(submission.bank_reference);
      return (
        submissionReference.length >= 5 &&
        transactionReference.includes(submissionReference) &&
        Number(submission.amount ?? 0) === transaction.credit
      );
    });

    if (exact) {
      used.add(exact.id);
      return {
        ...transaction,
        matched_submission_id: exact.id,
        match_status: "exact" as const,
      };
    }

    const possible = approvedSubmissions.find((submission) => {
      if (used.has(submission.id)) return false;
      return Number(submission.amount ?? 0) === transaction.credit;
    });

    if (possible) {
      used.add(possible.id);
      return {
        ...transaction,
        matched_submission_id: possible.id,
        match_status: "possible" as const,
      };
    }

    return transaction;
  });
}

export async function createMonthlyFinanceReport(formData: FormData) {
  const supabase = await supabaseServer();
  const reportingMonth = getString(formData, "reporting_month");
  const openingBalance = getNumber(formData, "opening_balance");
  const closingBalance = getNumber(formData, "closing_balance");
  const notes = getString(formData, "notes");
  const pastedRows = getString(formData, "statement_rows");
  const statementFile = formData.get("statement_file");

  if (!reportingMonth) {
    throw new Error("Select the reporting month.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("You must be signed in to create a finance report.");
  }

  const { data: actor } = await supabase
    .from("members")
    .select("id, role, status")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<{ id: string; role: string; status: string }>();

  if (!actor || actor.status !== "approved" || !["treasurer", "admin"].includes(actor.role)) {
    throw new Error("Only treasurer or admin can generate finance reports.");
  }

  let statementFilePath: string | null = null;
  let statementText = pastedRows;

  if (isUploadableStatement(statementFile)) {
    const extension = statementFile.name.split(".").pop()?.toLowerCase() || "dat";
    statementFilePath = `${reportingMonth}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("bank-statements")
      .upload(statementFilePath, statementFile, {
        cacheControl: "3600",
        contentType: statementFile.type || "application/octet-stream",
        upsert: false,
      });
    assertOk(uploadError, "Upload bank statement");

    if (/text|csv|plain|tab-separated/i.test(statementFile.type) || /\.(csv|txt|tsv)$/i.test(statementFile.name)) {
      statementText = `${statementText}\n${await statementFile.text()}`.trim();
    }
  }

  const { data: statementImport, error: importError } = await supabase
    .from("bank_statement_imports")
    .insert({
      reporting_month: reportingMonth,
      statement_file_url: statementFilePath,
      original_file_name: isUploadableStatement(statementFile) ? statementFile.name : null,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      notes: notes || null,
      uploaded_by: actor.id,
      status: "processed",
    })
    .select("id")
    .single<{ id: string }>();
  assertOk(importError, "Create statement import");

  if (!statementImport) {
    throw new Error("Create statement import failed: no import record was returned.");
  }

  const { data: approvedSubmissions } = await supabase
    .from("deposit_submissions")
    .select("id, amount, deposit_date, bank_reference, sender_name, member_id")
    .eq("status", "approved")
    .eq("contribution_month", reportingMonth);

  const parsedTransactions = applyMatches(
    parseStatementText(statementText),
    (approvedSubmissions ?? []) as ApprovedSubmission[]
  );

  if (parsedTransactions.length > 0) {
    const { error: transactionError } = await supabase
      .from("bank_statement_transactions")
      .insert(
        parsedTransactions.map((transaction) => ({
          statement_import_id: statementImport.id,
          ...transaction,
        }))
      );
    assertOk(transactionError, "Create statement transactions");
  }

  const totalDeposits = parsedTransactions.reduce((total, row) => total + row.credit, 0);
  const matchedDeposits = parsedTransactions
    .filter((row) => row.matched_submission_id)
    .reduce((total, row) => total + row.credit, 0);
  const unmatchedDeposits = Math.max(totalDeposits - matchedDeposits, 0);
  const memberCount = new Set(
    (approvedSubmissions ?? []).map((submission) => submission.member_id)
  ).size;
  const exceptionCount =
    parsedTransactions.filter((row) => row.match_status !== "exact").length +
    Math.max((approvedSubmissions ?? []).length - parsedTransactions.filter((row) => row.matched_submission_id).length, 0);

  const { error: reportError } = await supabase
    .from("finance_monthly_reports")
    .upsert(
      {
        reporting_month: reportingMonth,
        statement_import_id: statementImport.id,
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        total_deposits: totalDeposits,
        approved_member_deposits: matchedDeposits,
        unmatched_deposits: unmatchedDeposits,
        member_count: memberCount,
        exception_count: exceptionCount,
        notes: notes || null,
        status: "draft",
        prepared_by: actor.id,
      },
      { onConflict: "reporting_month" }
    );
  assertOk(reportError, "Generate monthly finance report");

  revalidatePath("/finance/statement-reports");
  revalidatePath("/finance/reports");
  revalidatePath("/chairman/finance-reports");
}
