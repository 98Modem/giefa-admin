"use client";

import { useEffect, useState, useTransition } from "react";
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

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-10 rounded-md bg-brand-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-300"
      >
        Edit report
      </button>

      {open && (
        <div className="pointer-events-none fixed inset-0 z-[120]">
          <section
            role="dialog"
            aria-modal="false"
            aria-label={`Edit ${reportingMonth} statement report`}
            className="pointer-events-auto fixed inset-0 flex flex-col overflow-hidden border-gray-200 bg-white shadow-2xl dark:border-white/15 dark:bg-gray-950 sm:inset-y-4 sm:left-auto sm:right-4 sm:w-[min(500px,calc(100vw-2rem))] sm:rounded-2xl sm:border"
          >
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-gray-950/95">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                    Approved edit
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    Edit {reportingMonth} report
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-300">
                    Correct row values, then recalculate member allocations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-11 min-w-11 rounded-full border border-gray-200 px-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Close edit report panel"
                >
                  x
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-gray-500 dark:text-gray-300">Statement</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {fieldValue(statementMovement) || "0"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-gray-500 dark:text-gray-300">Interest</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {fieldValue(interestAmount) || "0"}
                  </p>
                </div>
              </div>
            </div>

            <form
              action={(formData) => {
                startTransition(async () => {
                  await applyFinanceReportEdit(formData);
                  setOpen(false);
                });
              }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <input type="hidden" name="request_id" value={requestId} />
                <input type="hidden" name="report_id" value={reportId} />

                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                    Reporting month
                    <input
                      value={reportingMonth}
                      readOnly
                      className="h-12 rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-600 outline-none dark:border-white/15 dark:bg-white/5 dark:text-gray-300"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                      Opening balance
                      <input
                        name="opening_balance"
                        inputMode="decimal"
                        defaultValue={fieldValue(openingBalance)}
                        className="h-12 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/15 dark:bg-white/10 dark:text-white dark:focus:ring-brand-400/20"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                      Closing balance
                      <input
                        name="closing_balance"
                        inputMode="decimal"
                        defaultValue={fieldValue(closingBalance)}
                        className="h-12 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/15 dark:bg-white/10 dark:text-white dark:focus:ring-brand-400/20"
                      />
                    </label>
                  </div>

                  <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                    Statement movement
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-300">
                      Total value read from the monthly statement.
                    </span>
                    <input
                      name="statement_movement"
                      inputMode="decimal"
                      defaultValue={fieldValue(statementMovement)}
                      className="h-12 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/15 dark:bg-white/10 dark:text-white dark:focus:ring-brand-400/20"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                    Approved member deposits
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-300">
                      Correct this only when the report should include a controlled manual adjustment.
                    </span>
                    <input
                      name="approved_member_deposits"
                      inputMode="decimal"
                      defaultValue={fieldValue(approvedDeposits)}
                      className="h-12 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/15 dark:bg-white/10 dark:text-white dark:focus:ring-brand-400/20"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                    Interest / variance
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-300">
                      Use this when finance must override the extracted periodic return.
                    </span>
                    <input
                      name="manual_interest_amount"
                      inputMode="decimal"
                      defaultValue={fieldValue(interestAmount)}
                      className="h-12 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/15 dark:bg-white/10 dark:text-white dark:focus:ring-brand-400/20"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                    Edit note
                    <textarea
                      name="notes"
                      rows={5}
                      defaultValue={notes ?? ""}
                      placeholder="Explain the correction for audit review."
                      className="resize-y rounded-lg border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/15 dark:bg-white/10 dark:text-white dark:focus:ring-brand-400/20"
                    />
                  </label>
                </div>

                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-100">
                  Approved deposits are saved as an audited adjustment, then daily weighted interest allocations are recalculated.
                </div>
              </div>

              <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-gray-950/95">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="min-h-12 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isPending}
                    className="min-h-12 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isPending ? "Applying..." : "Apply edit"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
