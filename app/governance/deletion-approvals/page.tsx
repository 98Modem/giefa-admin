import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  approveSuspension,
  rejectSuspension,
} from "@/app/actions/giefa";
import { dateLabel, getMembers, memberName } from "@/app/lib/giefa/liveData";

export default async function DeletionApprovalsPage() {
  const suspendedMembers = await getMembers("suspended");

  return (
    <FeaturePage
      eyebrow="Governance"
      title="Suspension Reviews"
      description="Review suspended members and decide whether suspension should stand or the member should be restored to active access."
      metrics={[
        { label: "Pending Review", value: String(suspendedMembers.length), detail: "Suspended members" },
        { label: "Approve", value: "Keep Suspended", detail: "Access remains blocked" },
        { label: "Reject", value: "Restore", detail: "Member returns to dashboard" },
        { label: "Data Source", value: "members", detail: "status = suspended" },
      ]}
      sections={[
        {
          title: "Two-Step Control",
          body: "General Secretary can suspend a member, while chairman or admin can review the decision.",
          items: ["Suspension review", "Leadership decision", "Access restoration when rejected"],
        },
        {
          title: "Data Safety",
          body: "Suspension review keeps financial records intact while preventing unauthorized dashboard access.",
          items: ["Preserve finance ledgers", "Record decision metadata", "Prevent accidental access"],
        },
      ]}
      table={{
        columns: ["Member", "Email", "Suspended Since", "Status", "Actions"],
        rows: suspendedMembers.map((member) => [
          memberName(member),
          member.email ?? "No email",
          dateLabel(member.created_at),
          "Pending review",
          <div key={member.id} className="flex flex-wrap gap-2">
            <form action={approveSuspension}>
              <input type="hidden" name="member_id" value={member.id} />
              <button
                type="submit"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Approve suspension
              </button>
            </form>
            <form action={rejectSuspension}>
              <input type="hidden" name="member_id" value={member.id} />
              <button
                type="submit"
                className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100"
              >
                Reject and restore
              </button>
            </form>
          </div>,
        ]),
        empty: "There are no suspended members awaiting review.",
      }}
    />
  );
}
