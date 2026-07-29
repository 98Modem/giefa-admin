import { unstable_noStore as noStore } from "next/cache";
import { supabaseServer } from "@/app/lib/supabase/server";

type HealthStatus = "ok" | "warning" | "error";

type Check = {
  label: string;
  status: HealthStatus;
  detail: string;
};

function envCheck(label: string, key: string, required = true): Check {
  const value = process.env[key]?.trim();

  if (value) {
    return {
      label,
      status: "ok",
      detail: `${key} is configured`,
    };
  }

  return {
    label,
    status: required ? "error" : "warning",
    detail: `${key} is missing`,
  };
}

function StatusPill({ status }: { status: HealthStatus }) {
  const classes =
    status === "ok"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
      : status === "warning"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
        : "border-rose-400/40 bg-rose-500/10 text-rose-100";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${classes}`}
    >
      {status}
    </span>
  );
}

function HealthCard({ check }: { check: Check }) {
  return (
    <div className="rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-card)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--theme-text)]">
            {check.label}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--theme-muted)]">
            {check.detail}
          </p>
        </div>
        <StatusPill status={check.status} />
      </div>
    </div>
  );
}

async function tableCheck(table: string): Promise<Check> {
  const supabase = await supabaseServer();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) {
    return {
      label: `Table: ${table}`,
      status: "error",
      detail: error.message,
    };
  }

  return {
    label: `Table: ${table}`,
    status: "ok",
    detail: `Reachable${typeof count === "number" ? `, ${count.toLocaleString()} row(s)` : ""}`,
  };
}

async function storageCheck(): Promise<Check> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.storage.from("deposit-proofs").list("", {
    limit: 1,
  });

  if (error) {
    return {
      label: "Storage: deposit-proofs",
      status: "warning",
      detail: `${error.message}. Confirm bucket exists and RLS policies allow approved members to upload.`,
    };
  }

  return {
    label: "Storage: deposit-proofs",
    status: "ok",
    detail: `Bucket is reachable${data ? "." : ""}`,
  };
}

export default async function SystemHealthPage() {
  noStore();

  const envChecks = [
    envCheck("Site URL", "NEXT_PUBLIC_SITE_URL"),
    envCheck("Supabase URL", "NEXT_PUBLIC_SUPABASE_URL"),
    envCheck("Supabase anon key", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    envCheck("Supabase service role", "SUPABASE_SERVICE_ROLE_KEY", false),
    envCheck("OCR provider", "GIEFA_OCR_PROVIDER", false),
    envCheck("Google Vision", "GOOGLE_CLOUD_VISION_API_KEY", false),
    envCheck("Gemini", "GEMINI_API_KEY", false),
    envCheck("OpenAI fallback", "OPENAI_API_KEY", false),
  ];

  const databaseChecks = await Promise.all([
    tableCheck("members"),
    tableCheck("notifications"),
    tableCheck("deposit_submissions"),
    tableCheck("finance_monthly_reports"),
    tableCheck("finance_interest_allocations"),
    tableCheck("ledger_entries"),
    storageCheck(),
  ]);

  const checks = [...envChecks, ...databaseChecks];
  const issueCount = checks.filter((check) => check.status !== "ok").length;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-card)] p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--theme-accent)]">
          System
        </p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[color:var(--theme-text)]">
              System Health
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--theme-muted)]">
              Production readiness checks for authentication, Supabase tables,
              storage, OCR, and finance reporting dependencies.
            </p>
          </div>
          <div className="rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-soft)] px-4 py-3 text-sm text-[color:var(--theme-text)]">
            {issueCount === 0
              ? "All visible checks are healthy"
              : `${issueCount} check(s) need attention`}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[color:var(--theme-muted)]">
          Environment
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {envChecks.map((check) => (
            <HealthCard key={check.label} check={check} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[color:var(--theme-muted)]">
          Supabase
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {databaseChecks.map((check) => (
            <HealthCard key={check.label} check={check} />
          ))}
        </div>
      </section>
    </main>
  );
}
