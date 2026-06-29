import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  dateLabel,
  getAuditLogs,
  getMemberLookup,
  memberName,
} from "@/app/lib/giefa/liveData";

export default async function ActivityLogsPage() {
  const [logs, members] = await Promise.all([
    getAuditLogs(),
    getMemberLookup(),
  ]);

  return (
    <FeaturePage
      eyebrow="Governance"
      title="Activity Logs"
      description="Live governance activity from audit_logs."
      metrics={[
        { label: "Visible Events", value: String(logs.length), detail: "Latest 50 rows" },
        { label: "Member Targets", value: String(logs.filter((log) => log.target_member).length), detail: "Target member set" },
        { label: "System Actions", value: String(logs.filter((log) => !log.target_member).length), detail: "No member target" },
        { label: "Data Source", value: "audit_logs", detail: "RLS controlled" },
      ]}
      table={{
        columns: ["Date", "Action", "Performed By", "Target Member"],
        rows: logs.map((log) => [
          dateLabel(log.created_at),
          log.action ?? "Unknown action",
          log.performed_by ? memberName(members[log.performed_by]) : "System",
          log.target_member ? memberName(members[log.target_member]) : "None",
        ]),
        empty: "No audit log records are visible.",
      }}
    />
  );
}
