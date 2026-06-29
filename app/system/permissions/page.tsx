import { FeaturePage } from "@/app/components/feature/FeaturePage";

export default function PermissionsPage() {
  return (
    <FeaturePage
      eyebrow="System"
      title="Permissions"
      description="Review role capabilities and the access model that controls GIEFA operations."
      metrics={[
        { label: "Roles", value: "5", detail: "Configured access groups" },
        { label: "Protected Areas", value: "9", detail: "Route-level restrictions" },
        { label: "RLS Tables", value: "7", detail: "Policy-controlled resources" },
        { label: "Overrides", value: "Admin", detail: "System-level correction role" },
      ]}
      sections={[
        {
          title: "Admin",
          body: "Full technical and system-level access for corrective operations, settings, and audit inspection.",
          items: ["Manage users and roles", "View audit logs", "Override system issues"],
        },
        {
          title: "Leadership",
          body: "Chairman, treasurer, and general secretary each operate separate governance duties.",
          items: ["Chairman oversight", "Treasurer finance decisions", "General Secretary membership"],
        },
        {
          title: "Member",
          body: "Members can view their own balances, growth, contributions, and request history.",
          items: ["Own dashboard", "Own fund requests", "Own contribution records"],
        },
      ]}
      table={{
        columns: ["Area", "Admin", "Chairman", "Treasurer", "General Secretary", "Member"],
        rows: [
          ["Members", "Full", "View/approve deletion", "None", "Manage", "Own record"],
          ["Finance", "Full", "View", "Manage", "Limited", "Own balances"],
          ["Governance", "Full", "View/manage", "Activity view", "Activity view", "None"],
        ],
      }}
    />
  );
}
