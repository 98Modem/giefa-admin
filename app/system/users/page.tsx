import { FeaturePage } from "@/app/components/feature/FeaturePage";
import { dateLabel, getMembers, memberName } from "@/app/lib/giefa/liveData";

export default async function SystemUsersPage() {
  const members = await getMembers();

  return (
    <FeaturePage
      eyebrow="System"
      title="Users & Roles"
      description="Live user/member register from Supabase members."
      metrics={[
        { label: "Total Members", value: String(members.length), detail: "All visible statuses" },
        { label: "Approved", value: String(members.filter((member) => member.status === "approved").length), detail: "Dashboard access" },
        { label: "Pending", value: String(members.filter((member) => member.status === "pending").length), detail: "Awaiting approval" },
        { label: "Privileged Roles", value: String(members.filter((member) => member.role !== "member").length), detail: "Leadership/system" },
      ]}
      table={{
        columns: ["Member", "Email", "Role", "Status", "Created"],
        rows: members.map((member) => [
          memberName(member),
          member.email ?? "No email",
          member.role,
          member.status,
          dateLabel(member.created_at),
        ]),
        empty: "No member records are visible.",
      }}
    />
  );
}
