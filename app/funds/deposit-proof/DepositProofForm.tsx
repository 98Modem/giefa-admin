"use client";

import {
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

type DepositProofFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

type Extraction = {
  amount: number | null;
  deposit_date: string | null;
  contribution_month: string | null;
  bank_reference: string | null;
  sender_name: string | null;
  emergency_amount: number | null;
  investment_amount: number | null;
  confidence: number;
  needs_review: boolean;
  notes: string;
};

type SelectedProof = {
  file: File;
  previewUrl: string | null;
};

const fieldClass =
  "mt-2 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/15 dark:bg-white/10 dark:text-white sm:text-sm";

const labelClass = "text-sm font-semibold text-gray-800 dark:text-gray-100";
const hintClass = "mt-1 text-xs leading-5 text-gray-500 dark:text-gray-300";

function setInputValue(ref: RefObject<HTMLInputElement | null>, value: string | number | null) {
  if (!ref.current || value === null || value === undefined) return;
  ref.current.value = String(value);
}

function toMoney(value: number) {
  return Math.max(0, Math.round(value || 0));
}

function defaultEmergencyAllocation(total: number) {
  return toMoney(total * 0.3);
}

function proofIsSupported(file: File) {
  return (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    file.type === "text/plain" ||
    /\.pdf$/i.test(file.name) ||
    /\.txt$/i.test(file.name)
  );
}

function isTouchUploadViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
}

export function DepositProofForm({ action }: DepositProofFormProps) {
  const [isScanning, startScan] = useTransition();
  const [selectedProofs, setSelectedProofs] = useState<SelectedProof[]>([]);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isDraggingProof, setIsDraggingProof] = useState(false);

  const proofRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const emergencyRef = useRef<HTMLInputElement>(null);
  const investmentRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);
  const senderRef = useRef<HTMLInputElement>(null);
  const confidenceRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);

  const confidenceLabel = useMemo(() => {
    if (!extraction) return "Not scanned";
    const percent = Math.round(extraction.confidence * 100);
    if (percent >= 90) return `High-confidence extraction (${percent}%)`;
    if (percent >= 70) return `Good extraction (${percent}%)`;
    return `Needs careful review (${percent}%)`;
  }, [extraction]);

  const selectedFileNames = selectedProofs.map((proof) => proof.file.name);
  const previewProof = selectedProofs.find((proof) => proof.previewUrl);

  useEffect(() => {
    return () => {
      selectedProofs.forEach((proof) => {
        if (proof.previewUrl) URL.revokeObjectURL(proof.previewUrl);
      });
    };
  }, [selectedProofs]);

  function setProofFiles(files: File[]) {
    setExtraction(null);
    setScanError(null);

    selectedProofs.forEach((proof) => {
      if (proof.previewUrl) URL.revokeObjectURL(proof.previewUrl);
    });

    const supportedFiles = files.filter(proofIsSupported).slice(0, 6);

    if (!supportedFiles.length) {
      setSelectedProofs([]);
      return;
    }

    const nextProofs = supportedFiles.map((file) => ({
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));

    setSelectedProofs(nextProofs);
    void scanProof(supportedFiles);
  }

  function handleProofChange() {
    setProofFiles(Array.from(proofRef.current?.files ?? []));
  }

  function assignDroppedProofs(files: FileList) {
    if (!proofRef.current) return;

    const transfer = new DataTransfer();
    Array.from(files)
      .filter(proofIsSupported)
      .slice(0, 6)
      .forEach((file) => transfer.items.add(file));
    proofRef.current.files = transfer.files;
    setProofFiles(Array.from(transfer.files));
  }

  function updateInvestmentBalance(totalValue?: number, emergencyValue?: number) {
    const total = toMoney(totalValue ?? Number(amountRef.current?.value));
    const emergency = Math.min(total, toMoney(emergencyValue ?? Number(emergencyRef.current?.value)));
    setInputValue(emergencyRef, emergency);
    setInputValue(investmentRef, total - emergency);
  }

  function updateDefaultAllocation(totalValue?: number) {
    const total = toMoney(totalValue ?? Number(amountRef.current?.value));
    const emergency = defaultEmergencyAllocation(total);
    setInputValue(emergencyRef, emergency);
    setInputValue(investmentRef, total - emergency);
  }

  function applyExtraction(next: Extraction) {
    setInputValue(amountRef, next.amount);
    if (next.amount) updateDefaultAllocation(next.amount);
    setInputValue(monthRef, next.contribution_month);
    setInputValue(dateRef, next.deposit_date);
    setInputValue(referenceRef, next.bank_reference);
    setInputValue(senderRef, next.sender_name);
    setInputValue(confidenceRef, next.confidence);
    setInputValue(notesRef, next.notes);
  }

  function scanProof(files?: File[]) {
    const proofFiles = files ?? Array.from(proofRef.current?.files ?? []);
    if (!proofFiles.length) {
      setScanError("Choose at least one proof file before scanning.");
      return;
    }

    setScanError(null);
    startScan(async () => {
      const formData = new FormData();
      proofFiles.forEach((file) => formData.append("proofs", file));

      const response = await fetch("/api/deposit-proof/extract", {
        method: "POST",
        body: formData,
      });
      const responseText = await response.text();
      let result: { error?: string; extraction?: Extraction };

      try {
        result = responseText
          ? JSON.parse(responseText)
          : {
              error:
                "The scan service returned an empty response. Please try again.",
            };
      } catch {
        result = {
          error:
            "The scan service returned an unreadable response. Please try again.",
        };
      }

      if (!response.ok) {
        setScanError(result?.error || "AI extraction failed. Enter the details manually.");
        setInputValue(confidenceRef, 0);
        setInputValue(notesRef, result?.error || "AI extraction unavailable; member entered details manually.");
        return;
      }

      if (!result.extraction) {
        setScanError("AI extraction returned no deposit details. Enter the details manually.");
        setInputValue(confidenceRef, 0);
        setInputValue(notesRef, "AI extraction returned no deposit details; member entered details manually.");
        return;
      }

      setExtraction(result.extraction);
      applyExtraction(result.extraction);
    });
  }

  return (
    <section className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm">
      <form action={action} className="space-y-4 p-4 sm:p-5">
        <input ref={confidenceRef} name="extraction_confidence" type="hidden" />
        <input ref={notesRef} name="extraction_notes" type="hidden" />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.88fr)_minmax(420px,1.12fr)]">
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--app-border)] bg-white/70 p-4 dark:bg-white/[0.03] sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                  1
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    1. Upload proof
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-200">
                    Add screenshots, PDFs, or text files. Scanning starts automatically.
                  </p>
                </div>
              </div>

              <input
                ref={proofRef}
                name="proofs"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,.pdf,.txt"
                multiple
                onChange={() => handleProofChange()}
                className="sr-only"
              />

              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (isTouchUploadViewport()) return;
                  setIsDraggingProof(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (isTouchUploadViewport()) return;
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (isTouchUploadViewport()) return;
                  setIsDraggingProof(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (isTouchUploadViewport()) return;
                  setIsDraggingProof(false);
                  if (event.dataTransfer.files.length) assignDroppedProofs(event.dataTransfer.files);
                }}
                className={`mt-4 rounded-2xl border border-dashed p-3 transition sm:p-4 ${
                  isDraggingProof
                    ? "border-brand-500 bg-brand-50 dark:border-brand-300 dark:bg-brand-500/15"
                    : "border-gray-300 bg-gray-50 dark:border-white/15 dark:bg-black/20"
                }`}
              >
                <p className="mb-3 hidden text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 sm:block">
                  Drop files here or browse
                </p>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 sm:hidden">
                  Choose proof files
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => proofRef.current?.click()}
                  className="flex min-h-12 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                >
                  Choose Proof Files
                </button>
                <button
                  type="button"
                  onClick={() => scanProof()}
                  disabled={isScanning || selectedProofs.length === 0}
                  className="flex min-h-12 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-300/30 dark:bg-brand-500/10 dark:text-brand-100 dark:hover:bg-brand-500/20"
                >
                  {isScanning ? "Scanning proof..." : "Re-scan AI extraction"}
                </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-white/15 dark:bg-black/20">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                    Selected
                  </p>
                  {selectedFileNames.length ? (
                    <div className="mt-2 space-y-1">
                      {selectedFileNames.map((name) => (
                        <p key={name} className="break-all text-sm font-medium text-gray-800 dark:text-gray-100">
                          {name}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                      No file selected
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm dark:border-brand-300/20 dark:bg-brand-500/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                    Scan
                  </p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {isScanning ? "Scanning..." : confidenceLabel}
                  </p>
                  {extraction?.needs_review && (
                    <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-200">
                      Review fields before sending.
                    </p>
                  )}
                </div>
              </div>

              {previewProof?.previewUrl ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-950/5 dark:border-white/15 dark:bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewProof.previewUrl}
                    alt="Selected deposit proof preview"
                    className="max-h-64 w-full object-contain sm:max-h-80"
                  />
                </div>
              ) : (
                <div className="mt-3 flex min-h-36 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 text-center text-sm text-gray-500 dark:border-white/15 dark:bg-black/20 dark:text-gray-300 sm:min-h-44">
                  Image preview appears here. PDFs and text files still scan.
                </div>
              )}
            </div>

            {scanError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-300/25 dark:bg-amber-500/10 dark:text-amber-100">
                <p className="font-semibold">AI scan unavailable</p>
                <p className="mt-1 leading-5">{scanError}</p>
                <p className="mt-2 leading-5">
                  Fill the fields manually. Finance will still verify against the bank statement.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--app-border)] bg-white/70 p-4 dark:bg-white/[0.03] sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                2
              </span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                  2. Confirm details
                </h3>
                <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-200">
                  Confirm the scanned values before finance review.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={labelClass}>Total amount (UGX)</span>
                <input
                  ref={amountRef}
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  required
                  inputMode="numeric"
                  placeholder="Example: 200000"
                  className={fieldClass}
                  onChange={(event) => updateDefaultAllocation(Number(event.currentTarget.value))}
                />
                <p className={hintClass}>Emergency auto-fills at 30%.</p>
              </label>

              <label className="block">
                <span className={labelClass}>Emergency allocation</span>
                <input
                  ref={emergencyRef}
                  name="emergency_amount"
                  type="number"
                  min="0"
                  step="1"
                  required
                  inputMode="numeric"
                  defaultValue="0"
                  className={fieldClass}
                  onChange={(event) => updateInvestmentBalance(undefined, Number(event.currentTarget.value))}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Investment allocation</span>
                <input
                  ref={investmentRef}
                  name="investment_amount"
                  type="number"
                  min="0"
                  step="1"
                  required
                  inputMode="numeric"
                  placeholder="Usually the remaining amount"
                  className={fieldClass}
                  readOnly
                />
                <p className={hintClass}>Automatically balances after the emergency allocation.</p>
              </label>

              <label className="block">
                <span className={labelClass}>Contribution month</span>
                <input
                  ref={monthRef}
                  name="contribution_month"
                  type="month"
                  required
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Deposit date</span>
                <input
                  ref={dateRef}
                  name="deposit_date"
                  type="date"
                  required
                  className={fieldClass}
                />
              </label>

              <label className="block sm:col-span-2">
                <span className={labelClass}>Bank reference</span>
                <input
                  ref={referenceRef}
                  name="bank_reference"
                  type="text"
                  placeholder="Transaction ID or reference number"
                  className={fieldClass}
                />
                <p className={hintClass}>
                  Use the reference shown on the proof.
                </p>
              </label>

              <label className="block sm:col-span-2">
                <span className={labelClass}>Sender name</span>
                <input
                  ref={senderRef}
                  name="sender_name"
                  type="text"
                  placeholder="Name shown on proof"
                  className={fieldClass}
                />
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-500/10 dark:text-emerald-100">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  3
                </span>
                <div>
                  <p className="font-semibold">Send to finance review</p>
                  <p className="mt-1 leading-5">
                    Finance posts it after bank matching.
                  </p>
                </div>
              </div>
              <button
                type="submit"
                className="mt-4 min-h-12 w-full rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                Confirm and Send to Finance
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
