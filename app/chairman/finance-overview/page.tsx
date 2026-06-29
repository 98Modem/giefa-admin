import { FeaturePage } from "@/app/components/feature/FeaturePage";

export default function ChairmanFinanceOverviewPage() {
  return (
    <FeaturePage
      eyebrow="Chairman"
      title="Finance Overview"
      description="Executive-level view of fund health, savings performance, request exposure, and governance signals."
      metrics={[
        { label: "Total Fund Value", value: "UGX 42.8M", detail: "Emergency + investment" },
        { label: "Emergency Reserve", value: "UGX 14.2M", detail: "Available association reserve" },
        { label: "Investment Pool", value: "UGX 28.6M", detail: "Active investment value" },
        { label: "Open Risk Items", value: "4", detail: "Needs leadership attention" },
      ]}
      sections={[
        {
          title: "Oversight",
          body: "The chairman can monitor fund performance and leadership activity without replacing treasurer operations.",
          items: ["Treasurer activity view", "Fund balance trend", "Request approval flow"],
        },
        {
          title: "Governance Signals",
          body: "High-level risk indicators help leadership identify financial and membership issues early.",
          items: ["Pending request volume", "Suspension/deletion signals", "Audit log anomalies"],
        },
      ]}
      table={{
        columns: ["Area", "Current Position", "Risk", "Owner"],
        rows: [
          ["Savings", "UGX 18.6M collected", "Medium", "Treasurer"],
          ["Emergency Requests", "6 pending", "Medium", "Treasurer"],
          ["Membership", "9 pending applications", "Low", "General Secretary"],
        ],
      }}
    />
  );
}
