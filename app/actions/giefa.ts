"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/app/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function assertOk(error: { message: string } | null, action: string) {
  if (error) {
    throw new Error(`${action} failed: ${error.message}`);
  }
}

export async function createEmergencyRequest(formData: FormData) {
  const supabase = await supabaseServer();
  const amount = Number(getString(formData, "amount"));

  if (!Number.isFinite(amount) || amount <= 0) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return;

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<{ id: string }>();

  if (!member) return;

  const { error } = await supabase.from("emergency_requests").insert({
    member_id: member.id,
    amount,
    status: "pending",
  });
  assertOk(error, "Create emergency request");

  revalidatePath("/funds/request");
  revalidatePath("/funds/my-requests");
  revalidatePath("/funds/pending");
}

export async function approveEmergencyRequest(formData: FormData) {
  const supabase = await supabaseServer();
  const requestId = getString(formData, "request_id");

  if (!requestId) return;

  const { error } = await supabase.rpc("approve_emergency_request", {
    p_request_id: requestId,
  });
  assertOk(error, "Approve emergency request");

  revalidatePath("/funds/pending");
  revalidatePath("/funds/approved");
  revalidatePath("/governance/activity-logs");
}

export async function rejectEmergencyRequest(formData: FormData) {
  const supabase = await supabaseServer();
  const requestId = getString(formData, "request_id");

  if (!requestId) return;

  const { error } = await supabase.rpc("reject_emergency_request", {
    p_request_id: requestId,
  });
  assertOk(error, "Reject emergency request");

  revalidatePath("/funds/pending");
  revalidatePath("/governance/activity-logs");
}

export async function approveMember(formData: FormData) {
  const supabase = await supabaseServer();
  const memberId = getString(formData, "member_id");

  if (!memberId) return;

  const { error } = await supabase.rpc("approve_member_v2", {
    p_member_id: memberId,
  });
  assertOk(error, "Approve member");

  revalidatePath("/members/pending");
  revalidatePath("/members/active");
  revalidatePath("/system/users");
}

export async function denyMember(formData: FormData) {
  const supabase = await supabaseServer();
  const memberId = getString(formData, "member_id");

  if (!memberId) return;

  const { error } = await supabase.rpc("deny_member_v2", {
    p_member_id: memberId,
  });
  assertOk(error, "Deny member");

  revalidatePath("/members/pending");
  revalidatePath("/system/users");
}

export async function suspendMember(formData: FormData) {
  const supabase = await supabaseServer();
  const memberId = getString(formData, "member_id");

  if (!memberId) return;

  const { error } = await supabase.rpc("suspend_member", {
    p_member_id: memberId,
  });
  assertOk(error, "Suspend member");

  revalidatePath("/members/active");
  revalidatePath("/members/suspended");
}

export async function approveSuspension(formData: FormData) {
  const supabase = await supabaseServer();
  const memberId = getString(formData, "member_id");

  if (!memberId) return;

  const { error } = await supabase.rpc("approve_suspension_v2", {
    p_member_id: memberId,
  });
  assertOk(error, "Approve suspension");

  revalidatePath("/governance/deletion-approvals");
  revalidatePath("/members/suspended");
  revalidatePath("/system/users");
}

export async function rejectSuspension(formData: FormData) {
  const supabase = await supabaseServer();
  const memberId = getString(formData, "member_id");

  if (!memberId) return;

  const { error } = await supabase.rpc("reject_suspension_v2", {
    p_member_id: memberId,
  });
  assertOk(error, "Reject suspension");

  revalidatePath("/governance/deletion-approvals");
  revalidatePath("/members/active");
  revalidatePath("/members/suspended");
  revalidatePath("/system/users");
}
