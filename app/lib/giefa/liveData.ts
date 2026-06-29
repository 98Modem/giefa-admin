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

export function sumBy<T>(
  rows: T[],
  selector: (row: T) => number | null | undefined
) {
  return rows.reduce((total, row) => total + Number(selector(row) ?? 0), 0);
}
