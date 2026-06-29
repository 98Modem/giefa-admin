import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  getFinanceMonthlyReports,
  money,
  sumBy,
} from "@/app/lib/giefa/liveData";

export default async function ChairmanFinanceReportsPage() {
  const reports = await getFinanceMonthlyReports();
  const readyForReview = reports.filter((report) => report.status === "draft");

  return (
    <FeaturePage
      eyebrow="Chairman"
      title="Finance Reports"
      description="Review treasurer-prepared monthly statement reports, matching exceptions, and finance close notes before association meetings."
      metrics={[
        { label: "Ready for Review", value: String(readyForReview.length), detail: "Draft reports" },
        { label: "Report Archive", value: String(reports.length), detail: "Generated months" },
        { label: "Exceptions", value: String(sumBy(reports, (report) => report.exception_count)), detail: "Open finance questions" },
        { label: "Approved Value", value: money(sumBy(reports, (report) => report.approved_member_deposits)), detail: "Posted member deposits" },
      ]}
      sections={[
        {
          title: "Leadership Review",
          body: "Chairman access focuses on oversight, finance accountability, edit approvals, and unresolved statement variances.",
          items: ["Read monthly summaries", "Approve report edits", "Compare closing balances"],
        },
        {
          title: "Meeting Preparation",
          body: "Reports should support executive committee discussions and member accountability.",
          items: ["Meeting-ready summaries", "Action items", "Historical comparison"],
        },
      ]}
      table={{
        columns: ["Period", "Statement Movement", "Interest / Variance", "Members", "Exceptions", "Status"],
        rows: reports.map((report) => [
          report.reporting_month,
          money(report.total_deposits),
          money(report.calculated_interest_amount ?? report.unmatched_deposits),
          String(report.member_count ?? 0),
          String(report.exception_count ?? 0),
          report.status ?? "draft",
        ]),
        empty: "No finance reports have been prepared yet.",
      }}
    />
  );
}
