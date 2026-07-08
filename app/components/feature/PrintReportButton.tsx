"use client";

import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

type ReportOption = {
  month: string;
  label: string;
};

export function PrintReportButton({ reports }: { reports: ReportOption[] }) {
  const [selectedMonth, setSelectedMonth] = useState(reports[0]?.month ?? "");
  const downloadHref = useMemo(() => {
    if (!selectedMonth) return "/api/finance-reports/monthly-pdf";
    return `/api/finance-reports/monthly-pdf?month=${encodeURIComponent(selectedMonth)}`;
  }, [selectedMonth]);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <label className="sr-only" htmlFor="finance-report-month">
        Report month
      </label>
      <select
        id="finance-report-month"
        value={selectedMonth}
        onChange={(event) => setSelectedMonth(event.target.value)}
        className="h-10 min-w-44 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-white/15 dark:bg-white/10 dark:text-white"
      >
        {reports.length === 0 ? (
          <option value="">No reports</option>
        ) : (
          reports.map((report) => (
            <option key={report.month} value={report.month}>
              {report.label}
            </option>
          ))
        )}
      </select>
      <a
        href={downloadHref}
        className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white ${
          selectedMonth
            ? "bg-brand-500 hover:bg-brand-600"
            : "pointer-events-none bg-gray-400"
        }`}
      >
        <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
        Download PDF
      </a>
    </div>
  );
}
