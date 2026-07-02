"use client";

import { useRef, useState, useTransition } from "react";
import { createMonthlyFinanceReport } from "@/app/actions/financeReports";

type ExtractedSummary = {
  reporting_month: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  net_asset_value: number | null;
  additional_investments: number | null;
  periodic_return: number | null;
  actual_after_tax_return: number | null;
  ytd_return_percent: number | null;
};

type ExtractionResponse = {
  text?: string;
  summary?: ExtractedSummary;
  found_fields?: number;
  error?: string;
};

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

export function StatementReportForm({ defaultMonth }: { defaultMonth: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [scanStatus, setScanStatus] = useState("Upload a statement to auto-fill the report fields.");
  const [scanError, setScanError] = useState("");
  const [reportingMonth, setReportingMonth] = useState(defaultMonth);
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [statementRows, setStatementRows] = useState("");
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<ExtractedSummary | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [statementFileName, setStatementFileName] = useState("");

  function assignDroppedFile(file: File) {
    if (!fileRef.current) return;

    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileRef.current.files = transfer.files;
    setStatementFileName(file.name);
    void scanStatement(file);
  }

  async function scanStatement(nextFile?: File) {
    const file = nextFile ?? fileRef.current?.files?.[0];

    if (!file) return;

    setStatementFileName(file.name);
    setScanError("");
    setScanStatus("Scanning statement...");

    const formData = new FormData();
    formData.append("statement_file", file);

    const response = await fetch("/api/statement-reports/extract", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as ExtractionResponse;

    if (!response.ok) {
      setScanStatus("Statement was not scanned.");
      setScanError(result.error ?? "Statement extraction failed.");
      return;
    }

    const extracted = result.summary ?? null;

    setSummary(extracted);
    setReportingMonth(extracted?.reporting_month ?? reportingMonth);
    setOpeningBalance(formatNumber(extracted?.opening_balance));
    setClosingBalance(formatNumber(extracted?.closing_balance));
    setStatementRows(result.text ?? "");
    setNotes(
      [
        extracted?.periodic_return !== null && extracted?.periodic_return !== undefined
          ? `Periodic return: ${extracted.periodic_return}`
          : "",
        extracted?.ytd_return_percent !== null && extracted?.ytd_return_percent !== undefined
          ? `YTD return: ${extracted.ytd_return_percent}%`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
    setScanStatus(`Auto-filled ${result.found_fields ?? 0} statement fields. Review and edit before generating.`);
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await createMonthlyFinanceReport(formData);
        });
      }}
      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-white/10"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
          New monthly close
        </p>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Upload statement and generate draft
        </h2>
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-200">
          Upload the SBG valuation PDF and GIEFA immediately fills the
          reporting month, opening balance, closing balance, return, and notes.
          Review the values, edit if needed, then generate the report.
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
          Reporting month
          <input
            type="month"
            name="reporting_month"
            value={reportingMonth}
            onChange={(event) => setReportingMonth(event.target.value)}
            required
            className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none focus:border-brand-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
          Opening balance
          <input
            name="opening_balance"
            inputMode="decimal"
            value={openingBalance}
            onChange={(event) => setOpeningBalance(event.target.value)}
            placeholder="0"
            className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none focus:border-brand-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
          Closing balance
          <input
            name="closing_balance"
            inputMode="decimal"
            value={closingBalance}
            onChange={(event) => setClosingBalance(event.target.value)}
            placeholder="0"
            className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none focus:border-brand-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
          Manual interest
          <input
            name="manual_interest_amount"
            inputMode="decimal"
            placeholder="Optional"
            className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none focus:border-brand-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
          />
        </label>
      </div>

      <label className="mt-4 grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
        Bank statement file
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) assignDroppedFile(file);
          }}
          onClick={() => fileRef.current?.click()}
          className={`group flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition ${
            isDragging
              ? "scale-[1.01] border-brand-500 bg-brand-50 shadow-lg shadow-brand-500/10 dark:border-brand-300 dark:bg-brand-500/15"
              : "border-gray-300 bg-gray-50 hover:border-brand-400 hover:bg-brand-50/60 dark:border-white/15 dark:bg-white/5 dark:hover:border-brand-300 dark:hover:bg-brand-500/10"
          }`}
        >
          <div
            className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border transition ${
              isDragging
                ? "border-brand-300 bg-white text-brand-700 dark:border-brand-200 dark:bg-white/10 dark:text-brand-100"
                : "border-gray-200 bg-white text-gray-500 group-hover:border-brand-200 group-hover:text-brand-600 dark:border-white/15 dark:bg-white/10 dark:text-gray-200"
            }`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 15V4" strokeLinecap="round" />
              <path d="m7 9 5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            {isDragging ? "Drop the statement here" : "Drop bank statement anywhere in this box"}
          </p>
          <p className="mt-2 max-w-md text-sm font-normal leading-6 text-gray-500 dark:text-gray-300">
            PDF, CSV, TSV, or text files are accepted. The whole area is clickable for desktop and mobile users.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <span className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition group-hover:bg-brand-600">
              Browse file
            </span>
            {statementFileName ? (
              <span className="max-w-[18rem] truncate rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 dark:border-white/15 dark:bg-white/10 dark:text-gray-100">
                {statementFileName}
              </span>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                No file selected
              </span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            name="statement_file"
            accept=".csv,.txt,.tsv,.pdf,application/pdf,text/plain,text/csv"
            onClick={(event) => event.stopPropagation()}
            onChange={() => scanStatement()}
            className="sr-only"
          />
        </div>
      </label>

      <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:border-brand-400/30 dark:bg-brand-500/10 dark:text-brand-100">
        {scanStatus}
        {scanError && <p className="mt-2 font-semibold text-rose-600 dark:text-rose-200">{scanError}</p>}
      </div>

      {summary && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["NAV", summary.net_asset_value],
            ["Investments", summary.additional_investments],
            ["Periodic return", summary.periodic_return],
            ["YTD return %", summary.ytd_return_percent],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/15 dark:bg-white/5"
            >
              <p className="text-xs text-gray-500 dark:text-gray-300">{label}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                {value ?? "Not read"}
              </p>
            </div>
          ))}
        </div>
      )}

      <label className="mt-4 grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
        Extracted statement text or correction rows
        <textarea
          name="statement_rows"
          rows={8}
          value={statementRows}
          onChange={(event) => setStatementRows(event.target.value)}
          placeholder="Upload a PDF to auto-fill this text, or paste SBG valuation text / transaction rows."
          className="resize-y rounded-lg border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none focus:border-brand-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
        />
      </label>

      <label className="mt-4 grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
        Finance notes
        <textarea
          name="notes"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes for exceptions, bank charges, interest, or month-end observations"
          className="resize-y rounded-lg border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none focus:border-brand-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="mt-5 w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Generating statement report..." : "Generate statement report"}
      </button>
    </form>
  );
}
