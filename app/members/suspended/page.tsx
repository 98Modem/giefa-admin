import { FeaturePage } from "@/app/components/feature/FeaturePage";
import { dateLabel, getMembers, memberName } from "@/app/lib/giefa/liveData";

export default async function SuspendedMembersPage() {
  const members = await getMembers("suspended");

  return (
    <FeaturePage
      eyebrow="Membership"
      title="Suspended Members"
      description="Live suspended member list. Final deletion approval remains a chairman/admin governance step."
      metrics={[
        { label: "Suspended", value: String(members.length), detail: "Access blocked" },
        { label: "Deletion Governance", value: "Chairman", detail: "Final approval" },
        { label: "History", value: "Retained", detail: "Financial records preserved" },
        { label: "Data Source", value: "members", detail: "status = suspended" },
      ]}
      table={{
        columns: ["Member", "Email", "Role", "Suspended Since"],
        rows: members.map((member) => [
          memberName(member),
          member.email ?? "No email",
          member.role,
          dateLabel(member.created_at),
        ]),
        empty: "There are no suspended members.",
      }}
    />
  );
}
