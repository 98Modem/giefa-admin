"use client";

import { useState, useTransition } from "react";
import { applyFinanceReportEdit } from "@/app/actions/financeReports";

type ReportEditDialogProps = {
  requestId: string;
  reportId: string;
  reportingMonth: string;
  openingBalance: number | null;
  closingBalance: number | null;
  statementMovement: number | null;
  approvedDeposits: number | null;
  interestAmount: number | null;
  notes: string | null;
};

function fieldValue(value: number | string | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

export function ReportEditDialog({
  requestId,
  reportId,
  reportingMonth,
  openingBalance,
  closingBalance,
  statementMovement,
  approvedDeposits,
  interestAmount,
  notes,
}: ReportEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
      >
        Edit report
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/15 dark:bg-gray-950">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                  Approved edit
                </p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  Edit {reportingMonth} statement report
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                  Update the current row values, then GIEFA will recalculate allocations and return the report to draft review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close edit report dialog"
              >
                <span aria-hidden="true" className="block h-4 w-4 text-center text-lg leading-3">
                  x
                </span>
              </button>
            </div>

            <form
              action={(formData) => {
                startTransition(async () => {
                  await applyFinanceReportEdit(formData);
                  setOpen(false);
                });
              }}
              className="px-5 py-5"
            >
              <input type="hidden" name="request_id" value={requestId} />
              <input type="hidden" name="report_id" value={reportId} />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                  Reporting month
                  <input
                    value={reportingMonth}
                    readOnly
                    className="h-11 rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-600 outline-none dark:border-white/15 dark:bg-white/5 dark:text-gray-300"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                  Statement movement
                  <input
                    name="statement_movement"
                    inputMode="decimal"
                    defaultValue={fieldValue(statementMovement)}
                    className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                  Opening balance
                  <input
                    name="opening_balance"
                    inputMode="decimal"
                    defaultValue={fieldValue(openingBalance)}
                    className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                  Closing balance
                  <input
                    name="closing_balance"
                    inputMode="decimal"
                    defaultValue={fieldValue(closingBalance)}
                    className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                  Approved member deposits
                  <input
                    name="approved_member_deposits"
                    inputMode="decimal"
                    defaultValue={fieldValue(approvedDeposits)}
                    className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                  Interest / variance
                  <input
                    name="manual_interest_amount"
                    inputMode="decimal"
                    defaultValue={fieldValue(interestAmount)}
                    className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
                  />
                </label>
              </div>

              <label className="mt-4 grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                Edit note
                <textarea
                  name="notes"
                  rows={4}
                  defaultValue={notes ?? ""}
                  placeholder="Explain the correction for audit review."
                  className="resize-y rounded-lg border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none transition focus:border-brand-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
                />
              </label>

              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-100">
                Approved member deposits are saved as a controlled adjustment against posted deposits, so audit history stays intact.
              </div>

              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  disabled={isPending}
                  className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPending ? "Applying edit..." : "Apply edit and recalculate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
