import { FeaturePage } from "@/app/components/feature/FeaturePage";

export default function ChairmanFinanceReportsPage() {
  return (
    <FeaturePage
      eyebrow="Chairman"
      title="Finance Reports"
      description="Review finalized and draft finance reports with governance context before association meetings."
      metrics={[
        { label: "Ready for Review", value: "3", detail: "Reports awaiting chairman review" },
        { label: "Approved Reports", value: "8", detail: "Financial year" },
        { label: "Exceptions", value: "2", detail: "Open finance questions" },
        { label: "Next Meeting", value: "Jul 12", detail: "Governance calendar" },
      ]}
      sections={[
        {
          title: "Leadership Review",
          body: "Chairman report access focuses on oversight, review, and governance questions.",
          items: ["Read finance summaries", "Review exceptions", "Compare period trends"],
        },
        {
          title: "Meeting Preparation",
          body: "Reports should support executive committee discussions and member accountability.",
          items: ["Meeting-ready summaries", "Action items", "Historical comparison"],
        },
      ]}
      table={{
        columns: ["Report", "Period", "Status", "Action"],
        rows: [
          ["Savings Summary", "June 2026", "Ready", "Review"],
          ["Investment Performance", "Q2 2026", "Draft", "Monitor"],
          ["Emergency Fund Exposure", "June 2026", "Ready", "Review"],
        ],
      }}
    />
  );
}
