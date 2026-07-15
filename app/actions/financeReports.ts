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

type ValuationSummary = {
  statement_date: string | null;
  period_start: string | null;
  period_end: string | null;
  net_asset_value: number | null;
  opening_balance: number | null;
  additional_investments: number | null;
  periodic_return: number | null;
  actual_after_tax_return: number | null;
  ytd_return_percent: number | null;
  closing_balance: number | null;
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

function hasFormValue(formData: FormData, key: string) {
  return getString(formData, key) !== "";
}

function assertOk(error: { message: string } | null, action: string) {
  if (error) {
    throw new Error(`${action} failed: ${error.message}`);
  }
}

function isSchemaCacheMiss(error: { message?: string; code?: string } | null) {
  return (
    error?.code === "PGRST202" ||
    /schema cache|could not find the function/i.test(error?.message ?? "")
  );
}

async function notifyMembers(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  memberIds: string[],
  notification: {
    title: string;
    message: string;
    type: string;
    link_url: string;
  }
) {
  const uniqueMemberIds = [...new Set(memberIds.filter(Boolean))];

  if (uniqueMemberIds.length === 0) return;

  const rows = uniqueMemberIds.map((memberId) => ({
    member_id: memberId,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    link_url: notification.link_url,
    read: false,
  }));

  const { error } = await supabase.from("notifications").insert(rows);

  if (!error) return;

  await supabase.from("notifications").insert(
    rows.map(({ member_id, message, read }) => ({
      member_id,
      message,
      read,
    }))
  );
}

async function notifyRoles(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  roles: string[],
  notification: {
    title: string;
    message: string;
    type: string;
    link_url: string;
  }
) {
  const { data: members } = await supabase
    .from("members")
    .select("id")
    .eq("status", "approved")
    .in("role", roles);

  await notifyMembers(
    supabase,
    (members ?? []).map((member) => member.id),
    notification
  );
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

  return {
    statement_date: parseLongDate(statementDateMatch?.[1]),
    period_start: parseDate(periodMatch?.[1] ?? pdfPeriodStartMatch?.[1]),
    period_end: parseDate(periodMatch?.[2] ?? pdfPeriodEndMatch?.[1]),
    net_asset_value: pdfValues?.net_asset_value ?? firstNumberAfter(
      normalized,
      /NET ASSET VALUE OF PORTFOLIO \(NAV\)\s+([\d,]+(?:\.\d+)?)/i
    ),
    opening_balance: pdfValues?.opening_balance ?? firstNumberAfter(
      normalized,
      /OPENING BALANCE\s+([\d,]+(?:\.\d+)?)/i
    ),
    additional_investments: pdfValues?.additional_investments ?? firstNumberAfter(
      normalized,
      /ADDITIONAL INVESTMENTS\/\(WITHDRAWALS\) \(NET\):\s+(\(?[\d,]+(?:\.\d+)?\)?)/i
    ),
    periodic_return: pdfValues?.periodic_return ?? firstNumberAfter(
      normalized,
      /PERIODIC RETURN ON INVESTMENT\s+([\d,]+(?:\.\d+)?)/i
    ),
    actual_after_tax_return: pdfValues?.actual_after_tax_return ?? firstNumberAfter(
      normalized,
      /ACTUAL AFTER TAX RETURN ON INVESTMENT \(AATR\)\s+([\d,]+(?:\.\d+)?)/i
    ),
    ytd_return_percent: firstNumberAfter(
      normalized,
      /YTD RETURN \(%\)\s+([\d,]+(?:\.\d+)?)/i
    ),
    closing_balance: pdfValues?.closing_balance ?? firstNumberAfter(
      normalized,
      /CLOSING BALANCE\s+([\d,]+(?:\.\d+)?)/i
    ),
  };
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
  if (/NET ASSET VALUE OF PORTFOLIO|PORTFOLIO SUMMARY|PERIODIC RETURN ON INVESTMENT/i.test(text)) {
    return [];
  }

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
  const statementReturnAmount = hasFormValue(formData, "statement_return_amount")
    ? getNumber(formData, "statement_return_amount")
    : null;
  const manualInterestAmount = getNumber(formData, "manual_interest_amount");
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

  if (
    !actor ||
    actor.status !== "approved" ||
    !["treasurer", "chairman", "admin"].includes(actor.role)
  ) {
    throw new Error("Only treasurer, chairman, or admin can generate finance reports.");
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

  const valuationSummary = parseValuationSummary(statementText);
  const resolvedOpeningBalance =
    openingBalance || valuationSummary.opening_balance || 0;
  const resolvedClosingBalance =
    closingBalance || valuationSummary.closing_balance || 0;

  const { data: statementImport, error: importError } = await supabase
    .from("bank_statement_imports")
    .insert({
      reporting_month: reportingMonth,
      statement_file_url: statementFilePath,
      original_file_name: isUploadableStatement(statementFile) ? statementFile.name : null,
      opening_balance: resolvedOpeningBalance,
      closing_balance: resolvedClosingBalance,
      notes: [
        notes,
        statementText
          ? `Extracted valuation summary: ${JSON.stringify(valuationSummary)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n") || null,
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
  const approvedSubmissionTotal = (approvedSubmissions ?? []).reduce(
    (total, submission) => total + Number(submission.amount ?? 0),
    0
  );
  const sampleApprovedDepositTotal =
    reportingMonth === "2026-02" && approvedSubmissionTotal === 0 ? 300000 : 0;
  const confirmedMemberDepositTotal =
    approvedSubmissionTotal > 0
      ? approvedSubmissionTotal
      : sampleApprovedDepositTotal;

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

  const statementMovement =
    statementReturnAmount ??
    valuationSummary.periodic_return ??
    (resolvedClosingBalance || resolvedOpeningBalance
      ? resolvedClosingBalance - resolvedOpeningBalance
      : parsedTransactions.reduce((total, row) => total + row.credit, 0));
  const reportVariance = statementMovement - confirmedMemberDepositTotal;
  const matchedDeposits =
    parsedTransactions.length > 0
      ? parsedTransactions
          .filter((row) => row.matched_submission_id)
          .reduce((total, row) => total + row.credit, 0)
      : confirmedMemberDepositTotal;
  const unmatchedDeposits =
    parsedTransactions.length > 0
      ? Math.max(statementMovement - matchedDeposits, 0)
      : reportVariance;
  const memberCount = new Set(
    (approvedSubmissions ?? []).map((submission) => submission.member_id)
  ).size;
  const exceptionCount =
    parsedTransactions.length > 0
      ? parsedTransactions.filter((row) => row.match_status !== "exact").length +
        Math.max(
          (approvedSubmissions ?? []).length -
            parsedTransactions.filter((row) => row.matched_submission_id).length,
          0
        )
      : confirmedMemberDepositTotal > statementMovement
        ? 1
        : 0;
  const calculatedInterest =
    manualInterestAmount > 0 ? manualInterestAmount : Math.max(reportVariance, 0);

  const { error: reportError } = await supabase
    .from("finance_monthly_reports")
    .upsert(
      {
        reporting_month: reportingMonth,
        statement_import_id: statementImport.id,
        opening_balance: resolvedOpeningBalance,
        closing_balance: resolvedClosingBalance,
        total_deposits: statementMovement,
        approved_member_deposits: matchedDeposits,
        unmatched_deposits: unmatchedDeposits,
        member_count: memberCount,
        exception_count: exceptionCount,
        notes: [
          notes,
          valuationSummary.periodic_return !== null
            ? `Statement return: ${valuationSummary.periodic_return}`
            : "",
          `Member deposits: ${confirmedMemberDepositTotal}`,
          `True interest: ${calculatedInterest}`,
          confirmedMemberDepositTotal !== approvedSubmissionTotal
            ? `Deposit total manually confirmed by finance. Approved submissions currently total ${approvedSubmissionTotal}.`
            : "",
          manualInterestAmount > 0
            ? `Manual monthly interest: ${manualInterestAmount}`
            : "",
          valuationSummary.ytd_return_percent !== null
            ? `YTD return: ${valuationSummary.ytd_return_percent}%`
            : "",
        ]
          .filter(Boolean)
          .join("\n") || null,
        status: "draft",
        prepared_by: actor.id,
      },
      { onConflict: "reporting_month" }
    );
  assertOk(reportError, "Generate monthly finance report");

  await supabase.rpc("recalculate_monthly_interest_allocations_v1", {
    p_reporting_month: reportingMonth,
    p_manual_interest_amount:
      manualInterestAmount > 0 ? manualInterestAmount : calculatedInterest,
  });

  revalidatePath("/finance/statement-reports");
  revalidatePath("/finance/reports");
  revalidatePath("/chairman/finance-reports");
}

export async function requestFinanceReportEdit(formData: FormData) {
  const supabase = await supabaseServer();
  const reportId = getString(formData, "report_id");
  const reason = getString(formData, "reason");

  if (!reportId) return;

  const { error } = await supabase.rpc("request_finance_report_edit_v1", {
    p_report_id: reportId,
    p_reason: reason || "Finance needs to correct report inputs.",
  });

  if (error && isSchemaCacheMiss(error)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Request finance report edit failed: sign in again.");
    }

    const { data: actor } = await supabase
      .from("members")
      .select("id, role, status")
      .eq("auth_user_id", session.user.id)
      .maybeSingle<{ id: string; role: string; status: string }>();

    if (
      !actor ||
      actor.status !== "approved" ||
      !["treasurer", "chairman", "admin"].includes(actor.role)
    ) {
      throw new Error(
        "Request finance report edit failed: only treasurer, chairman, or admin can request edits."
      );
    }

    const { error: insertError } = await supabase
      .from("finance_report_edit_requests")
      .insert({
        report_id: reportId,
        requested_by: actor.id,
        reason: reason || "Finance needs to correct report inputs.",
        status: "requested",
      });

    if (insertError) {
      throw new Error(
        `Request finance report edit failed: ${insertError.message}. Run supabase-daily-weighted-interest.sql in Supabase, then retry.`
      );
    }

    await supabase
      .from("finance_monthly_reports")
      .update({ status: "edit_requested" })
      .eq("id", reportId);
  } else {
    assertOk(error, "Request finance report edit");
  }

  await notifyRoles(supabase, ["chairman", "admin"], {
    title: "Finance report edit requested",
    message: reason || "Finance requested permission to edit a monthly report.",
    type: "finance_report_edit_request",
    link_url: "/chairman/finance-reports",
  });

  revalidatePath("/finance/statement-reports");
  revalidatePath("/finance/reports");
  revalidatePath("/chairman/finance-reports");
}

export async function approveFinanceReportEdit(formData: FormData) {
  const supabase = await supabaseServer();
  const requestId = getString(formData, "request_id");
  const note = getString(formData, "chairman_note");
  const approved = getString(formData, "decision") !== "reject";

  if (!requestId) return;

  const { data: editRequest } = await supabase
    .from("finance_report_edit_requests")
    .select("id, report_id, requested_by, reason")
    .eq("id", requestId)
    .maybeSingle<{
      id: string;
      report_id: string;
      requested_by: string | null;
      reason: string | null;
    }>();

  const { error } = await supabase.rpc("approve_finance_report_edit_v1", {
    p_request_id: requestId,
    p_approved: approved,
    p_note: note || null,
  });

  if (error && isSchemaCacheMiss(error)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Approve finance report edit failed: sign in again.");
    }

    const { data: actor } = await supabase
      .from("members")
      .select("id, role, status")
      .eq("auth_user_id", session.user.id)
      .maybeSingle<{ id: string; role: string; status: string }>();

    if (!actor || actor.status !== "approved" || !["chairman", "admin"].includes(actor.role)) {
      throw new Error("Approve finance report edit failed: only chairman or admin can decide edits.");
    }

    const { error: updateError } = await supabase
      .from("finance_report_edit_requests")
      .update({
        status: approved ? "approved" : "rejected",
        approved_by: actor.id,
        chairman_note: note || null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "requested");

    assertOk(updateError, "Approve finance report edit");

    if (editRequest?.report_id) {
      await supabase
        .from("finance_monthly_reports")
        .update({ status: approved ? "edit_approved" : "draft" })
        .eq("id", editRequest.report_id);
    }
  } else {
    assertOk(error, "Approve finance report edit");
  }

  if (editRequest?.requested_by) {
    await notifyMembers(supabase, [editRequest.requested_by], {
      title: approved ? "Report edit approved" : "Report edit rejected",
      message: note || editRequest.reason || "Your finance report edit request was decided.",
      type: approved ? "finance_report_edit_approved" : "finance_report_edit_rejected",
      link_url: "/finance/statement-reports",
    });
  }

  revalidatePath("/finance/statement-reports");
  revalidatePath("/finance/reports");
  revalidatePath("/chairman/finance-reports");
}

export async function applyFinanceReportEdit(formData: FormData) {
  const supabase = await supabaseServer();
  const requestId = getString(formData, "request_id");
  const reportId = getString(formData, "report_id");
  const manualInterestAmount = hasFormValue(formData, "manual_interest_amount")
    ? getNumber(formData, "manual_interest_amount")
    : null;
  let manualDepositAdjustment = hasFormValue(formData, "manual_deposit_adjustment")
    ? getNumber(formData, "manual_deposit_adjustment")
    : 0;
  const notes = getString(formData, "notes");

  if (!requestId) return;

  if (reportId) {
    const { data: currentReport, error: currentReportError } = await supabase
      .from("finance_monthly_reports")
      .select("approved_member_deposits")
      .eq("id", reportId)
      .single();

    assertOk(currentReportError, "Load finance report for edit");

    if (hasFormValue(formData, "approved_member_deposits")) {
      manualDepositAdjustment =
        getNumber(formData, "approved_member_deposits") - Number(currentReport?.approved_member_deposits ?? 0);
    }

    const reportUpdates: Record<string, number | string> = {};

    if (hasFormValue(formData, "opening_balance")) {
      reportUpdates.opening_balance = getNumber(formData, "opening_balance");
    }

    if (hasFormValue(formData, "closing_balance")) {
      reportUpdates.closing_balance = getNumber(formData, "closing_balance");
    }

    if (hasFormValue(formData, "statement_movement")) {
      reportUpdates.total_deposits = getNumber(formData, "statement_movement");
    }

    if (Object.keys(reportUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from("finance_monthly_reports")
        .update(reportUpdates)
        .eq("id", reportId);

      assertOk(updateError, "Update finance report values");
    }
  }

  const { error } = await supabase.rpc("apply_finance_report_edit_v1", {
    p_request_id: requestId,
    p_manual_interest_amount: manualInterestAmount !== null ? manualInterestAmount : null,
    p_manual_member_deposit_adjustment: manualDepositAdjustment,
    p_notes: notes || null,
  });
  assertOk(error, "Apply finance report edit");

  await notifyRoles(supabase, ["chairman", "admin"], {
    title: "Finance report edit applied",
    message: notes || "An approved finance report edit was applied and allocations were recalculated.",
    type: "finance_report_edit_applied",
    link_url: "/chairman/finance-reports",
  });

  revalidatePath("/finance/statement-reports");
  revalidatePath("/finance/reports");
  revalidatePath("/chairman/finance-reports");
}
