import { supabaseServer } from "@/app/lib/supabase/server";
import { Role } from "@/app/employee_type/roles";

export type MemberStatus = "pending" | "approved" | "suspended" | "denied";

export type MemberRecord = {
  id: string;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: Role;
  status: MemberStatus;
  created_at: string | null;
};

export type EmergencyRequestRecord = {
  id: string;
  member_id: string;
  amount: number | null;
  status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
};

export type MonthlyContributionRecord = {
  id: string;
  member_id: string;
  month: string | null;
  amount: number | null;
  emergency_amount: number | null;
  investment_amount: number | null;
  created_at: string | null;
};

export type EmergencyFundRecord = {
  id: string;
  member_id: string;
  total_contributed: number | null;
  total_withdrawn: number | null;
  available: number | null;
  created_at: string | null;
};

export type ShareRecord = {
  id: string;
  member_id: string;
  total_amount: number | null;
  total_shares: number | null;
  created_at: string | null;
};

export type AuditLogRecord = {
  id: string;
  action: string | null;
  performed_by: string | null;
  target_member: string | null;
  created_at: string | null;
};

export type NotificationRecord = {
  id: string;
  member_id: string;
  message: string | null;
  read: boolean | null;
  created_at: string | null;
};

export type DepositSubmissionStatus =
  | "submitted"
  | "needs_review"
  | "approved"
  | "rejected";

export type DepositSubmissionRecord = {
  id: string;
  member_id: string;
  contribution_month: string | null;
  amount: number | null;
  emergency_amount: number | null;
  investment_amount: number | null;
  deposit_date: string | null;
  bank_reference: string | null;
  sender_name: string | null;
  proof_url: string | null;
  extracted_text: string | null;
  confidence: number | null;
  status: DepositSubmissionStatus | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string | null;
};

export type BankStatementImportRecord = {
  id: string;
  reporting_month: string;
  statement_file_url: string | null;
  original_file_name: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  notes: string | null;
  status: string | null;
  uploaded_by: string | null;
  created_at: string | null;
};

export type BankStatementTransactionRecord = {
  id: string;
  statement_import_id: string;
  transaction_date: string | null;
  description: string | null;
  reference: string | null;
  debit: number | null;
  credit: number | null;
  running_balance: number | null;
  matched_submission_id: string | null;
  match_status: string | null;
  created_at: string | null;
};

export type FinanceMonthlyReportRecord = {
  id: string;
  reporting_month: string;
  statement_import_id: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  total_deposits: number | null;
  approved_member_deposits: number | null;
  unmatched_deposits: number | null;
  member_count: number | null;
  exception_count: number | null;
  notes: string | null;
  status: string | null;
  prepared_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  manual_interest_amount?: number | null;
  calculated_interest_amount?: number | null;
  variance_amount?: number | null;
  variance_status?: string | null;
};

export type FinanceInterestAllocationRecord = {
  id: string;
  report_id: string;
  reporting_month: string;
  member_id: string;
  opening_investment_balance: number | null;
  month_investment_deposits: number | null;
  weighted_balance: number | null;
  allocation_weight: number | null;
  interest_amount: number | null;
  days_in_month: number | null;
  calculation_method: string | null;
  generated_at: string | null;
};

export type FinanceReportEditRequestRecord = {
  id: string;
  report_id: string;
  requested_by: string | null;
  approved_by: string | null;
  reason: string | null;
  chairman_note: string | null;
  status: string | null;
  created_at: string | null;
  approved_at: string | null;
  applied_at: string | null;
};

export type MemberLookup = Record<string, MemberRecord>;

export function money(value: number | null | undefined) {
  return `UGX ${Number(value ?? 0).toLocaleString()}`;
}

export function dateLabel(value: string | null | undefined) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function memberName(member: MemberRecord | undefined) {
  return (
    [member?.first_name, member?.last_name].filter(Boolean).join(" ") ||
    member?.email ||
    "Unknown member"
  );
}

export async function getCurrentMember() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const { data } = await supabase
    .from("members")
    .select("id, auth_user_id, first_name, last_name, email, role, status, created_at")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<MemberRecord>();

  return data;
}

export async function getMembers(status?: MemberStatus) {
  const supabase = await supabaseServer();
  let query = supabase
    .from("members")
    .select("id, auth_user_id, first_name, last_name, email, role, status, created_at")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data } = await query;
  return (data ?? []) as MemberRecord[];
}

export async function getMemberLookup() {
  const members = await getMembers();

  return members.reduce<MemberLookup>((lookup, member) => {
    lookup[member.id] = member;
    return lookup;
  }, {});
}

export async function getEmergencyRequests(status?: string) {
  const supabase = await supabaseServer();
  let query = supabase
    .from("emergency_requests")
    .select("id, member_id, amount, status, approved_by, approved_at, created_at")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data } = await query;
  return (data ?? []) as EmergencyRequestRecord[];
}

export async function getMonthlyContributions() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("monthly_contributions")
    .select("id, member_id, month, amount, emergency_amount, investment_amount, created_at")
    .order("created_at", { ascending: false });

  return (data ?? []) as MonthlyContributionRecord[];
}

export async function getEmergencyFunds() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("emergency_funds")
    .select("id, member_id, total_contributed, total_withdrawn, available, created_at")
    .order("created_at", { ascending: false });

  return (data ?? []) as EmergencyFundRecord[];
}

export async function getShares() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("shares")
    .select("id, member_id, total_amount, total_shares, created_at")
    .order("created_at", { ascending: false });

  return (data ?? []) as ShareRecord[];
}

export async function getAuditLogs() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, performed_by, target_member, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []) as AuditLogRecord[];
}

export async function getNotifications() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("notifications")
    .select("id, member_id, message, read, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []) as NotificationRecord[];
}

export async function getDepositSubmissions(status?: DepositSubmissionStatus) {
  const supabase = await supabaseServer();
  let query = supabase
    .from("deposit_submissions")
    .select(
      "id, member_id, contribution_month, amount, emergency_amount, investment_amount, deposit_date, bank_reference, sender_name, proof_url, extracted_text, confidence, status, reviewed_by, reviewed_at, rejection_reason, created_at"
    )
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data } = await query;
  return (data ?? []) as DepositSubmissionRecord[];
}

export async function getBankStatementImports() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("bank_statement_imports")
    .select(
      "id, reporting_month, statement_file_url, original_file_name, opening_balance, closing_balance, notes, status, uploaded_by, created_at"
    )
    .order("created_at", { ascending: false });

  return (data ?? []) as BankStatementImportRecord[];
}

export async function getBankStatementTransactions(importId?: string) {
  const supabase = await supabaseServer();
  let query = supabase
    .from("bank_statement_transactions")
    .select(
      "id, statement_import_id, transaction_date, description, reference, debit, credit, running_balance, matched_submission_id, match_status, created_at"
    )
    .order("transaction_date", { ascending: false });

  if (importId) {
    query = query.eq("statement_import_id", importId);
  }

  const { data } = await query;
  return (data ?? []) as BankStatementTransactionRecord[];
}

export async function getFinanceMonthlyReports() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("finance_monthly_reports")
    .select(
      "id, reporting_month, statement_import_id, opening_balance, closing_balance, total_deposits, approved_member_deposits, unmatched_deposits, member_count, exception_count, notes, status, prepared_by, created_at, updated_at, manual_interest_amount, calculated_interest_amount, variance_amount, variance_status"
    )
    .order("reporting_month", { ascending: false });

  if (error) {
    const { data: fallback } = await supabase
      .from("finance_monthly_reports")
      .select(
        "id, reporting_month, statement_import_id, opening_balance, closing_balance, total_deposits, approved_member_deposits, unmatched_deposits, member_count, exception_count, notes, status, prepared_by, created_at, updated_at"
      )
      .order("reporting_month", { ascending: false });

    return (fallback ?? []) as FinanceMonthlyReportRecord[];
  }

  return (data ?? []) as FinanceMonthlyReportRecord[];
}

export async function getFinanceInterestAllocations(reportId?: string) {
  const supabase = await supabaseServer();
  let query = supabase
    .from("finance_interest_allocations")
    .select(
      "id, report_id, reporting_month, member_id, opening_investment_balance, month_investment_deposits, weighted_balance, allocation_weight, interest_amount, days_in_month, calculation_method, generated_at"
    )
    .order("interest_amount", { ascending: false });

  if (reportId) {
    query = query.eq("report_id", reportId);
  }

  const { data, error } = await query;

  if (error) return [];

  return (data ?? []) as FinanceInterestAllocationRecord[];
}

export async function getFinanceReportEditRequests(reportId?: string) {
  const supabase = await supabaseServer();
  let query = supabase
    .from("finance_report_edit_requests")
    .select(
      "id, report_id, requested_by, approved_by, reason, chairman_note, status, created_at, approved_at, applied_at"
    )
    .order("created_at", { ascending: false });

  if (reportId) {
    query = query.eq("report_id", reportId);
  }

  const { data, error } = await query;

  if (error) return [];

  return (data ?? []) as FinanceReportEditRequestRecord[];
}

export function sumBy<T>(
  rows: T[],
  selector: (row: T) => number | null | undefined
) {
  return rows.reduce((total, row) => total + Number(selector(row) ?? 0), 0);
}
