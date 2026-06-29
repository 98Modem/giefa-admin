import Link from "next/link";
import { ReactNode } from "react";

type Metric = {
  label: string;
  value: string;
  detail?: string;
};

type Action = {
  label: string;
  href: string;
};

type Section = {
  title: string;
  body: string;
  items?: string[];
};

type Table = {
  columns: string[];
  rows: ReactNode[][];
  empty?: string;
};

type FeaturePageProps = {
  eyebrow?: string;
  title: string;
  description: string;
  metrics?: Metric[];
  primaryAction?: Action;
  secondaryActions?: Action[];
  sections?: Section[];
  table?: Table;
};

export function FeaturePage({
  eyebrow,
  title,
  description,
  metrics = [],
  primaryAction,
  secondaryActions = [],
  sections = [],
  table,
}: FeaturePageProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-white/20 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {eyebrow && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-200">
            {description}
          </p>
        </div>

        {(primaryAction || secondaryActions.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {secondaryActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
              >
                {action.label}
              </Link>
            ))}
            {primaryAction && (
              <Link
                href={primaryAction.href}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                {primaryAction.label}
              </Link>
            )}
          </div>
        )}
      </div>

      {metrics.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-gray-500 dark:text-gray-300">
                {metric.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                {metric.value}
              </p>
              {metric.detail && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                  {metric.detail}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {sections.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-lg border bg-white p-5 shadow-sm"
            >
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-200">
                {section.body}
              </p>
              {section.items && (
                <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-100">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {table && (
        <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4 dark:border-white/15">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Current Records
            </h2>
          </div>
          {table.rows.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500 dark:text-gray-200">
              {table.empty ?? "No records found."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:text-gray-200">
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column} className="px-5 py-3 font-semibold">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {table.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-5 py-4 text-gray-700 dark:text-gray-100"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
