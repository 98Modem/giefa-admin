import { suspendMember } from "@/app/actions/giefa";
import { FeaturePage } from "@/app/components/feature/FeaturePage";
import { dateLabel, getMembers, memberName } from "@/app/lib/giefa/liveData";

export default async function ActiveMembersPage() {
  const members = await getMembers("approved");

  return (
    <FeaturePage
      eyebrow="Membership"
      title="Active Members"
      description="Live approved membership register. Suspension is handled through the governance RPC."
      metrics={[
        { label: "Approved Members", value: String(members.length), detail: "Active access" },
        { label: "Leadership", value: String(members.filter((member) => member.role !== "member").length), detail: "Privileged roles" },
        { label: "Regular Members", value: String(members.filter((member) => member.role === "member").length), detail: "Participant role" },
        { label: "Data Source", value: "members", detail: "status = approved" },
      ]}
      table={{
        columns: ["Member", "Email", "Role", "Joined", "Action"],
        rows: members.map((member) => [
          memberName(member),
          member.email ?? "No email",
          member.role,
          dateLabel(member.created_at),
          <form key={member.id} action={suspendMember}>
            <input type="hidden" name="member_id" value={member.id} />
            <button className="rounded-md border border-warning-300 px-3 py-1.5 text-xs font-medium text-warning-700 hover:bg-warning-50">
              Suspend
            </button>
          </form>,
        ]),
        empty: "No approved members are visible.",
      }}
    />
  );
}
