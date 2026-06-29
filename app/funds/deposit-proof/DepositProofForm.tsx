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

const fieldClass =
  "mt-2 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/15 dark:bg-white/10 dark:text-white sm:text-sm";

const labelClass = "text-sm font-semibold text-gray-800 dark:text-gray-100";
const hintClass = "mt-1 text-xs leading-5 text-gray-500 dark:text-gray-300";

function setInputValue(ref: RefObject<HTMLInputElement | null>, value: string | number | null) {
  if (!ref.current || value === null || value === undefined) return;
  ref.current.value = String(value);
}

export function DepositProofForm({ action }: DepositProofFormProps) {
  const [isScanning, startScan] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
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
    return `${Math.round(extraction.confidence * 100)}% confidence`;
  }, [extraction]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleProofChange(nextFile?: File) {
    const file = nextFile ?? proofRef.current?.files?.[0];
    setExtraction(null);
    setScanError(null);

    if (!file) {
      setPreviewUrl(null);
      setSelectedFileName("");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function assignDroppedProof(file: File) {
    if (!proofRef.current) return;

    const transfer = new DataTransfer();
    transfer.items.add(file);
    proofRef.current.files = transfer.files;
    handleProofChange(file);
  }

  function applyExtraction(next: Extraction) {
    setInputValue(amountRef, next.amount);
    setInputValue(emergencyRef, next.emergency_amount ?? 0);
    setInputValue(investmentRef, next.investment_amount ?? next.amount);
    setInputValue(monthRef, next.contribution_month);
    setInputValue(dateRef, next.deposit_date);
    setInputValue(referenceRef, next.bank_reference);
    setInputValue(senderRef, next.sender_name);
    setInputValue(confidenceRef, next.confidence);
    setInputValue(notesRef, next.notes);
  }

  function scanProof() {
    const file = proofRef.current?.files?.[0];
    if (!file) {
      setScanError("Choose a screenshot before scanning.");
      return;
    }

    setScanError(null);
    startScan(async () => {
      const formData = new FormData();
      formData.append("proof", file);

      const response = await fetch("/api/deposit-proof/extract", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        setScanError(result?.error || "AI extraction failed. Enter the details manually.");
        setInputValue(confidenceRef, 0);
        setInputValue(notesRef, result?.error || "AI extraction unavailable; member entered details manually.");
        return;
      }

      setExtraction(result.extraction);
      applyExtraction(result.extraction);
    });
  }

  return (
    <section className="mx-auto max-w-7xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/15 dark:bg-white/10">
      <div className="border-b border-gray-200 bg-gray-50/80 px-4 py-5 dark:border-white/10 dark:bg-white/5 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
            New contribution evidence
          </p>
          <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
            Upload, confirm, then send to finance
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-200">
            Add your payment screenshot, let AI suggest the details when available, then review the fields before finance matches it with the bank statement.
          </p>
        </div>
      </div>

      <form action={action} className="space-y-6 p-4 sm:p-6">
        <input ref={confidenceRef} name="extraction_confidence" type="hidden" />
        <input ref={notesRef} name="extraction_notes" type="hidden" />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/15 dark:bg-white/[0.03] sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                  1
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Upload payment proof
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-200">
                    Choose a screenshot from your phone or computer. PNG, JPG, and WebP are supported.
                  </p>
                </div>
              </div>

              <input
                ref={proofRef}
                name="proof"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={() => handleProofChange()}
                className="sr-only"
              />

              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDraggingProof(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDraggingProof(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDraggingProof(false);
                  const file = event.dataTransfer.files[0];
                  if (file) assignDroppedProof(file);
                }}
                className={`mt-4 rounded-xl border border-dashed p-3 transition ${
                  isDraggingProof
                    ? "border-brand-500 bg-brand-50 dark:border-brand-300 dark:bg-brand-500/15"
                    : "border-gray-300 bg-gray-50 dark:border-white/15 dark:bg-black/20"
                }`}
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                  Drop screenshot here or browse
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => proofRef.current?.click()}
                  className="flex min-h-14 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                >
                  Choose Screenshot
                </button>
                <button
                  type="button"
                  onClick={scanProof}
                  disabled={isScanning || !selectedFileName}
                  className="flex min-h-14 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-300/30 dark:bg-brand-500/10 dark:text-brand-100 dark:hover:bg-brand-500/20"
                >
                  {isScanning ? "Scanning proof..." : "Scan with AI"}
                </button>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-white/15 dark:bg-black/20">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                  Selected file
                </p>
                <p className="mt-1 break-all text-sm font-medium text-gray-800 dark:text-gray-100">
                  {selectedFileName || "No screenshot selected yet"}
                </p>
              </div>

              {previewUrl ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-950/5 dark:border-white/15 dark:bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Selected deposit proof preview"
                    className="max-h-[360px] w-full object-contain"
                  />
                </div>
              ) : (
                <div className="mt-4 flex min-h-56 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center text-sm text-gray-500 dark:border-white/15 dark:bg-black/20 dark:text-gray-300">
                  Screenshot preview will appear here.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm dark:border-brand-300/20 dark:bg-brand-500/10 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Extraction status
                  </p>
                  <p className="mt-1 text-gray-600 dark:text-gray-200">
                    {confidenceLabel}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm dark:bg-white/10 dark:text-brand-100">
                  Finance verifies later
                </span>
              </div>
              {extraction?.needs_review && (
                <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-200">
                  Please review the extracted fields carefully before submitting.
                </p>
              )}
              {scanError && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-300/25 dark:bg-amber-500/10 dark:text-amber-100">
                  <p className="font-semibold">AI scan unavailable</p>
                  <p className="mt-1 leading-5">{scanError}</p>
                  <p className="mt-2 leading-5">
                    Fill the fields manually from the screenshot. Finance will still verify it against the bank statement.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/15 dark:bg-white/[0.03] sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                2
              </span>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Confirm deposit details
                </h3>
                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-200">
                  Check every field before sending. These are pending records until finance approves them.
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
                />
                <p className={hintClass}>Use the amount shown on the proof.</p>
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
                />
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
                  placeholder="Transaction ID, reference number, or statement narration"
                  className={fieldClass}
                />
                <p className={hintClass}>
                  If the screenshot has a reference number, paste or confirm it here.
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

            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-500/10 dark:text-emerald-100">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  3
                </span>
                <div>
                  <p className="font-semibold">Send to finance review</p>
                  <p className="mt-1 leading-6">
                    Your balance will not change immediately. Finance must match this proof with the bank statement before posting it to your ledger.
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
