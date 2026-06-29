import { supabaseServer } from "@/app/lib/supabase/server";
import { Role } from "@/app/employee_type/roles";

type AuditLogInput = {
  actorUserId: string;
  actorRole: Role;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
};

export async function logAudit({
  actorUserId,
  actorRole,
  action,
  entity,
  entityId,
  metadata,
  req,
}: AuditLogInput) {
  const supabase = await supabaseServer();

  const headers = req?.headers;

  await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId,
    actor_role: actorRole,
    action,
    entity,
    entity_id: entityId,
    metadata,
    ip_address: headers?.get("x-forwarded-for") ?? null,
    user_agent: headers?.get("user-agent") ?? null,
  });
}
