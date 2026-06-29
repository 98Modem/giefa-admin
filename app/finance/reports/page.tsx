import { FeaturePage } from "@/app/components/feature/FeaturePage";

export default function FinancialReportsPage() {
  return (
    <FeaturePage
      eyebrow="Finance"
      title="Financial Reports"
      description="Prepare monthly, quarterly, and leadership-ready reports for savings, emergency funds, and investments."
      primaryAction={{ label: "Generate Report", href: "/finance/reports" }}
      metrics={[
        { label: "Reports Ready", value: "5", detail: "Current financial year" },
        { label: "Draft Reports", value: "2", detail: "Awaiting review" },
        { label: "Open Exceptions", value: "3", detail: "Need correction" },
        { label: "Next Close", value: "Jul 5", detail: "Monthly finance close" },
      ]}
      sections={[
        {
          title: "Report Coverage",
          body: "Reports should combine member savings, fund balances, requests, disbursements, and growth.",
          items: ["Monthly savings report", "Emergency request report", "Investment growth report"],
        },
        {
          title: "Review Process",
          body: "Treasurer prepares reports while chairman and admin can inspect finalized records and audit activity.",
          items: ["Draft preparation", "Exception resolution", "Leadership review"],
        },
        {
          title: "Export Targets",
          body: "The reporting page should eventually export PDF and spreadsheet-ready data for meetings.",
          items: ["Monthly PDF summary", "CSV ledger export", "Meeting-ready figures"],
        },
      ]}
      table={{
        columns: ["Report", "Period", "Owner", "Status"],
        rows: [
          ["Monthly Savings", "May 2026", "Treasurer", "Ready"],
          ["Fund Performance", "Q2 2026", "Treasurer", "Draft"],
          ["Emergency Requests", "June 2026", "Treasurer", "Open"],
        ],
      }}
    />
  );
}
