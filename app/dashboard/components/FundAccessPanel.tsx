import { Role } from "@/app/employee_type/roles";
import { FUND_VISIBILITY } from "../config/fundVisibility";

type Props = {
  role: Role;
};

const matrix = [
  ["Personal", "personal"],
  ["Collective", "collective"],
  ["Ledgers", "memberLedger"],
  ["Approvals", "approvals"],
  ["Reports", "reports"],
  ["Governance", "governance"],
] as const;

export function FundAccessPanel({ role }: Props) {
  const profile = FUND_VISIBILITY[role];

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-900/80 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
            Fund visibility
          </p>
          <h2 className="mt-2 text-lg font-semibold text-gray-950 dark:text-white">
            {profile.label}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            {profile.summary}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:min-w-[32rem]">
          {matrix.map(([label, key]) => {
            const enabled = profile[key];

            return (
              <div
                key={key}
                className="rounded-lg border bg-white px-3 py-2 dark:bg-white/5"
              >
                <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
                  {label}
                </p>
                <p
                  className={
                    enabled
                      ? "mt-1 text-sm font-semibold text-brand-700 dark:text-brand-200"
                      : "mt-1 text-sm font-semibold text-gray-400 dark:text-gray-500"
                  }
                >
                  {enabled ? "Visible" : "Restricted"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100">
        {profile.note}
      </div>
    </section>
  );
}
