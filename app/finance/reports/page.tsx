import { FeaturePage } from "@/app/components/feature/FeaturePage";
import {
  getFinanceMonthlyReports,
  money,
  sumBy,
} from "@/app/lib/giefa/liveData";

export default async function FinancialReportsPage() {
  const reports = await getFinanceMonthlyReports();
  const drafts = reports.filter((report) => report.status === "draft");
  const exceptions = sumBy(reports, (report) => report.exception_count);

  return (
    <FeaturePage
      eyebrow="Finance"
      title="Financial Reports"
      description="Review generated monthly finance reports from bank statement imports, member deposit matching, and treasurer close notes."
      primaryAction={{ label: "New Statement Report", href: "/finance/statement-reports" }}
      metrics={[
        { label: "Reports Ready", value: String(reports.length), detail: "Generated from statements" },
        { label: "Draft Reports", value: String(drafts.length), detail: "Awaiting review" },
        { label: "Open Exceptions", value: String(exceptions), detail: "Possible or unmatched rows" },
        {
          label: "Matched Deposits",
          value: money(sumBy(reports, (report) => report.approved_member_deposits)),
          detail: "Statement-matched value",
        },
      ]}
      sections={[
        {
          title: "Report Coverage",
          body: "Reports combine bank statement credits, approved member submissions, unmatched deposits, balances, and finance notes.",
          items: ["Monthly deposit report", "Statement matching", "Exception summary"],
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
        columns: ["Period", "Deposits", "Matched", "Unmatched", "Exceptions", "Status"],
        rows: reports.map((report) => [
          report.reporting_month,
          money(report.total_deposits),
          money(report.approved_member_deposits),
          money(report.unmatched_deposits),
          String(report.exception_count ?? 0),
          report.status ?? "draft",
        ]),
        empty: "No finance reports have been generated yet.",
      }}
    />
  );
}
