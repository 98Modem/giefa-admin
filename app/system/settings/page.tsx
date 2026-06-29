import { FeaturePage } from "@/app/components/feature/FeaturePage";

export default function SettingsPage() {
  return (
    <FeaturePage
      eyebrow="System"
      title="Settings"
      description="Configure association-wide defaults, fund rules, approval behavior, and operational safeguards."
      metrics={[
        { label: "Member Approval", value: "Manual", detail: "General Secretary review" },
        { label: "Emergency Fund", value: "Enabled", detail: "Treasurer approval" },
        { label: "Audit Logging", value: "Required", detail: "Privileged actions" },
        { label: "Notifications", value: "Enabled", detail: "Member updates" },
      ]}
      sections={[
        {
          title: "Association Rules",
          body: "Operational settings should define contribution expectations, request limits, and approval behavior.",
          items: ["Monthly contribution amount", "Emergency request limits", "Investment allocation rules"],
        },
        {
          title: "Security",
          body: "Settings should protect system integrity and prevent accidental privileged changes.",
          items: ["Role-based access", "RLS enforcement", "Audit log requirements"],
        },
        {
          title: "Notifications",
          body: "Notification settings should keep members informed about approvals, requests, and contribution updates.",
          items: ["Approval alerts", "Request decision alerts", "Meeting reminders"],
        },
      ]}
      table={{
        columns: ["Setting", "Value", "Owner", "Review"],
        rows: [
          ["Member approvals", "Manual", "General Secretary", "Quarterly"],
          ["Emergency approvals", "Treasurer", "Treasurer", "Monthly"],
          ["Deletion approvals", "Chairman final", "Chairman", "As needed"],
        ],
      }}
    />
  );
}
