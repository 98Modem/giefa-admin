"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/app/lib/supabase/server";
import { Role } from "@/app/employee_type/roles";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function assertOk(error: { message: string } | null, action: string) {
  if (error) {
    throw new Error(`${action} failed: ${error.message}`);
  }
}

const ASSIGNABLE_ROLES: Role[] = [
  "chairman",
  "treasurer",
  "general_sec",
  "member",
];

function isAssignableRole(value: string): value is Role {
  return ASSIGNABLE_ROLES.includes(value as Role);
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

export async function assignMemberRole(formData: FormData) {
  const supabase = await supabaseServer();
  const memberId = getString(formData, "member_id");
  const nextRole = getString(formData, "role");

  if (!memberId || !isAssignableRole(nextRole)) {
    throw new Error("Choose a valid member and role.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: actor } = await supabase
    .from("members")
    .select("id, role, status")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<{ id: string; role: Role; status: string }>();

  if (!actor || actor.status !== "approved") {
    throw new Error("Only approved leadership users can assign roles.");
  }

  if (!["chairman", "admin"].includes(actor.role)) {
    throw new Error("Only chairman or admin can assign association roles.");
  }

  const { data: target } = await supabase
    .from("members")
    .select("id, first_name, last_name, role, status")
    .eq("id", memberId)
    .maybeSingle<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      role: Role;
      status: string;
    }>();

  if (!target || target.status !== "approved") {
    throw new Error("Roles can only be assigned to approved active members.");
  }

  if (actor.role === "chairman" && nextRole === "admin") {
    throw new Error("Chairman cannot assign the technical admin role.");
  }

  const demotingChairman = target.role === "chairman" && nextRole !== "chairman";
  const selfChange = actor.id === target.id;

  if (demotingChairman && actor.role !== "admin") {
    const { count } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("role", "chairman")
      .eq("status", "approved")
      .neq("id", target.id);

    if (!count) {
      throw new Error(
        "Assign another approved member as chairman before the current chairman changes role."
      );
    }
  }

  const { error } = await supabase
    .from("members")
    .update({ role: nextRole })
    .eq("id", target.id);
  assertOk(error, "Assign member role");

  await supabase.from("notifications").insert({
    member_id: target.id,
    title: "Role updated",
    message: `Your GIEFA role has changed to ${nextRole.replace("_", " ")}.`,
    type: "role_updated",
    link_url: "/dashboard",
    read: false,
  });

  revalidatePath("/chairman/finance-overview");
  revalidatePath("/system/users");
  revalidatePath("/dashboard");

  if (selfChange) {
    redirect("/dashboard");
  }
}
