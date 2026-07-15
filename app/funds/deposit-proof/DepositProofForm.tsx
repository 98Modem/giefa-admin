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

type ContributionMode = "single" | "multiple";

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

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function buildMonthOptions() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });
  const today = new Date();
  const monthsBeforeCurrent = 15 * 12;
  const monthsAfterCurrent = 5 * 12;

  return Array.from({ length: monthsBeforeCurrent + 1 }, (_, index) => {
    const offset = -index;
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const value = date.toISOString().slice(0, 7);

    return {
      group: index === 0 ? "Current month" : "Previous months",
      label: formatter.format(date),
      value,
    };
  }).concat(
    Array.from({ length: monthsAfterCurrent }, (_, index) => {
      const offset = index + 1;
      const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const value = date.toISOString().slice(0, 7);

      return {
        group: "Future months",
        label: formatter.format(date),
        value,
      };
    }),
  );
}

function formatMonthValue(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function getMonthDistance(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return "";

  const today = new Date();
  const currentIndex = today.getFullYear() * 12 + today.getMonth();
  const selectedIndex = year * 12 + month - 1;
  const distance = selectedIndex - currentIndex;

  if (distance === 0) return "Current";
  if (distance === 1) return "Next month";
  if (distance > 1) return `In ${distance} months`;
  if (distance === -1) return "Last month";

  return `${Math.abs(distance)} months ago`;
}

function monthGroupLabel(group: string) {
  if (group === "Current month") return "Now";
  if (group === "Previous months") return "Past contributions";
  return "Future/prepaid contributions";
}

function monthGroupDescription(group: string) {
  if (group === "Current month") return "Most deposits belong here.";
  if (group === "Previous months") return "Use for late proof or correction.";
  return "Use when one payment covers upcoming months.";
}

function buildUnknownMonthOption(value: string) {
  const today = new Date();
  const [year, month] = value.split("-").map(Number);
  const selectedIndex = year * 12 + month - 1;
  const currentIndex = today.getFullYear() * 12 + today.getMonth();
  const group = selectedIndex > currentIndex ? "Future months" : "Previous months";

  return {
    group,
    label: formatMonthValue(value),
    value,
  };
}

function groupMonthOptions(options: ReturnType<typeof buildMonthOptions>) {
  const groups: { group: string; options: typeof options }[] = [];

  options.forEach((option) => {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.group === option.group) {
      lastGroup.options.push(option);
      return;
    }

    groups.push({
      group: option.group,
      options: [option],
    });
  });

  return groups;
}

function sortMonthValues(values: string[]) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function DepositProofForm({ action }: DepositProofFormProps) {
  const [isScanning, startScan] = useTransition();
  const [selectedProofs, setSelectedProofs] = useState<SelectedProof[]>([]);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isDraggingProof, setIsDraggingProof] = useState(false);
  const [contributionMonth, setContributionMonth] = useState(currentMonthValue);
  const [contributionMode, setContributionMode] = useState<ContributionMode>("single");
  const [contributionMonths, setContributionMonths] = useState<string[]>([
    currentMonthValue(),
  ]);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  const proofRef = useRef<HTMLInputElement>(null);
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const emergencyRef = useRef<HTMLInputElement>(null);
  const investmentRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);
  const senderRef = useRef<HTMLInputElement>(null);
  const confidenceRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const displayedMonthOptions = useMemo(() => {
    if (monthOptions.some((option) => option.value === contributionMonth)) {
      return monthOptions;
    }

    return [buildUnknownMonthOption(contributionMonth), ...monthOptions];
  }, [contributionMonth, monthOptions]);
  const groupedMonthOptions = useMemo(
    () => groupMonthOptions(displayedMonthOptions),
    [displayedMonthOptions],
  );
  const selectedMonthLabel =
    displayedMonthOptions.find((option) => option.value === contributionMonth)?.label ??
    formatMonthValue(contributionMonth);
  const selectedContributionMonths = useMemo(
    () => sortMonthValues([...new Set(contributionMonths)]),
    [contributionMonths],
  );

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

  useEffect(() => {
    if (!isMonthPickerOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (monthPickerRef.current?.contains(event.target as Node)) return;
      setIsMonthPickerOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMonthPickerOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMonthPickerOpen]);

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
    if (next.contribution_month) {
      setContributionMonth(next.contribution_month);
      setContributionMonths([next.contribution_month]);
      setContributionMode("single");
    }
    setInputValue(dateRef, next.deposit_date);
    setInputValue(referenceRef, next.bank_reference);
    setInputValue(senderRef, next.sender_name);
    setInputValue(confidenceRef, next.confidence);
    setInputValue(notesRef, next.notes);
  }

  function chooseContributionMonth(value: string) {
    setContributionMonth(value);

    if (contributionMode === "single") {
      setContributionMonths([value]);
      setIsMonthPickerOpen(false);
      return;
    }

    setContributionMonths((current) => {
      if (current.includes(value)) {
        const next = current.filter((month) => month !== value);
        return next.length ? next : [value];
      }

      return sortMonthValues([...current, value]);
    });
  }

  function removeContributionMonth(value: string) {
    setContributionMonths((current) => {
      const next = current.filter((month) => month !== value);
      if (next.length) {
        if (contributionMonth === value) setContributionMonth(next[0]);
        return next;
      }

      return current;
    });
  }

  function changeContributionMode(nextMode: ContributionMode) {
    setContributionMode(nextMode);

    if (nextMode === "single") {
      setContributionMonths([contributionMonth]);
    } else {
      setContributionMonths((current) => (current.length ? current : [contributionMonth]));
    }
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
                <div ref={monthPickerRef} className="relative mt-2">
                  <input
                    type="hidden"
                    name="contribution_month"
                    value={selectedContributionMonths[0] ?? contributionMonth}
                    required
                  />
                  <input
                    type="hidden"
                    name="contribution_mode"
                    value={contributionMode}
                  />
                  <input
                    type="hidden"
                    name="contribution_months"
                    value={JSON.stringify(selectedContributionMonths)}
                  />
                  <div className="mb-2 grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-white/15 dark:bg-black/20">
                    {[
                      { label: "Single", value: "single" as const },
                      { label: "Multiple", value: "multiple" as const },
                    ].map((option) => {
                      const isActive = contributionMode === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => changeContributionMode(option.value)}
                          className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${
                            isActive
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    aria-label="Choose contribution month"
                    aria-expanded={isMonthPickerOpen}
                    onClick={() => setIsMonthPickerOpen((isOpen) => !isOpen)}
                    className="flex h-12 w-full items-center justify-between rounded-xl border border-brand-200 bg-white px-3 text-left text-base font-semibold text-gray-900 shadow-sm outline-none transition hover:border-brand-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-emerald-300/25 dark:bg-white/10 dark:text-white sm:text-sm"
                  >
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate">
                        {contributionMode === "multiple"
                          ? `${selectedContributionMonths.length} month${
                              selectedContributionMonths.length === 1 ? "" : "s"
                            } selected`
                          : selectedMonthLabel}
                      </span>
                      <span className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-300">
                        {contributionMode === "multiple"
                          ? "Tap months below to add or remove"
                          : getMonthDistance(contributionMonth)}
                      </span>
                    </span>
                    <svg
                      aria-hidden="true"
                      className={`ml-3 h-4 w-4 shrink-0 text-gray-500 transition dark:text-gray-300 ${
                        isMonthPickerOpen ? "rotate-180" : ""
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  {isMonthPickerOpen && (
                    <div className="absolute left-0 right-0 z-[70] mt-2 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-2xl shadow-brand-500/15 ring-1 ring-black/5 dark:border-emerald-300/20 dark:bg-gray-950 dark:shadow-black/40 dark:ring-white/10">
                      <div className="border-b border-gray-100 bg-brand-50/80 px-4 py-3 dark:border-white/10 dark:bg-emerald-500/10">
                        <p className="text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-emerald-200">
                          {contributionMode === "multiple"
                            ? "Select covered months"
                            : "Select contribution month"}
                        </p>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                          {contributionMode === "multiple"
                            ? "Tap any month to include it. Use this for one deposit covering several months."
                            : "Starts at the current month. Future months are available for prepaid deposits."}
                        </p>
                      </div>
                      <div className="max-h-72 overflow-y-auto p-2 sm:max-h-80">
                        {groupedMonthOptions.map((group) => (
                          <div key={group.group} className="not-first:mt-2">
                            <div className="px-2 py-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {monthGroupLabel(group.group)}
                              </p>
                              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                {monthGroupDescription(group.group)}
                              </p>
                            </div>
                            <div className="space-y-1">
                              {group.options.map((option) => {
                                const isSelected =
                                  contributionMode === "multiple"
                                    ? selectedContributionMonths.includes(option.value)
                                    : option.value === contributionMonth;
                                const distance = getMonthDistance(option.value);

                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => chooseContributionMonth(option.value)}
                                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                                      isSelected
                                        ? "bg-emerald-600 text-white shadow-sm"
                                        : "text-gray-800 hover:bg-brand-50 hover:text-brand-700 dark:text-gray-100 dark:hover:bg-white/10 dark:hover:text-white"
                                    }`}
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate font-semibold">
                                        {option.label}
                                      </span>
                                      <span
                                        className={`mt-0.5 block text-xs ${
                                          isSelected
                                            ? "text-emerald-50"
                                            : "text-gray-500 dark:text-gray-400"
                                        }`}
                                      >
                                        {distance}
                                      </span>
                                    </span>
                                    {isSelected && (
                                      <span className="shrink-0 rounded-full bg-white/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
                                        Selected
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      {contributionMode === "multiple" && (
                        <div className="border-t border-gray-100 bg-gray-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                          <button
                            type="button"
                            onClick={() => setIsMonthPickerOpen(false)}
                            className="h-10 w-full rounded-lg bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700"
                          >
                            Done selecting months
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {contributionMode === "multiple" && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-300/20 dark:bg-emerald-500/10">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                        Split months
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        Total splits equally on submit
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedContributionMonths.map((month) => (
                        <span
                          key={month}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm ring-1 ring-emerald-200 dark:bg-white/10 dark:text-white dark:ring-emerald-300/20"
                        >
                          {formatMonthValue(month)}
                          {selectedContributionMonths.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeContributionMonth(month)}
                              className="rounded-full px-1 text-gray-500 hover:bg-gray-100 hover:text-rose-600 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-rose-200"
                              aria-label={`Remove ${formatMonthValue(month)}`}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
