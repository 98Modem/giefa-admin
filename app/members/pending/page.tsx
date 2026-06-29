import { approveMember, denyMember } from "@/app/actions/giefa";
import { FeaturePage } from "@/app/components/feature/FeaturePage";
import { dateLabel, getMembers, memberName } from "@/app/lib/giefa/liveData";

export default async function PendingMembersPage() {
  const members = await getMembers("pending");

  return (
    <FeaturePage
      eyebrow="Membership"
      title="Pending Applications"
      description="Live pending member applications from Supabase. Approval and denial use RPC functions."
      metrics={[
        { label: "Pending", value: String(members.length), detail: "Awaiting secretary review" },
        { label: "Review Owner", value: "General Secretary", detail: "Membership governance" },
        { label: "Access Status", value: "Blocked", detail: "Pending users cannot enter dashboard" },
        { label: "Data Source", value: "members", detail: "status = pending" },
      ]}
      table={{
        columns: ["Applicant", "Email", "Submitted", "Actions"],
        rows: members.map((member) => [
          memberName(member),
          member.email ?? "No email",
          dateLabel(member.created_at),
          <div key={member.id} className="flex flex-wrap gap-2">
            <form action={approveMember}>
              <input type="hidden" name="member_id" value={member.id} />
              <button className="rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white">
                Approve
              </button>
            </form>
            <form action={denyMember}>
              <input type="hidden" name="member_id" value={member.id} />
              <button className="rounded-md bg-error-600 px-3 py-1.5 text-xs font-medium text-white">
                Deny
              </button>
            </form>
          </div>,
        ]),
        empty: "There are no pending member applications.",
      }}
    />
  );
}
