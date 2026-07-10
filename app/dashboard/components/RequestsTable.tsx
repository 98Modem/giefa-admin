"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/app/lib/supabase/client";
import { Role } from "@/app/employee_type/roles";
import { TableSkeleton } from "./skeletons/TableSkeleton";

type Props = {
  role: Role;
  memberId?: string;
};

type Request = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
};

export function RequestsTable({ role, memberId }: Props) {
  const [data, setData] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const title = role === "member" ? "My Fund Requests" : "Fund Requests";

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);

      let query = supabaseBrowser
        .from("emergency_requests")
        .select("id, amount, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (role === "member" && memberId) {
        query = query.eq("member_id", memberId);
      }

      const { data, error } = await query;

      if (!error && data) {
        setData(data);
      }

      setLoading(false);
    };

    fetchRequests();
  }, [memberId, role]);

  if (loading) return <TableSkeleton />;

  return (
    <div className="min-w-0 rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-900/80 sm:p-6">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
            Requests
          </p>
          <h3 className="mt-1 text-lg font-semibold text-gray-950 dark:text-white">
            {title}
          </h3>
        </div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
          Latest {data.length} records
        </p>
      </div>

      {data.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-gray-500 dark:text-gray-300">
          No fund requests found.
        </div>
      ) : (
        <>
        <div className="grid gap-3 sm:hidden">
          {data.map((req) => (
            <article
              key={req.id}
              className="rounded-xl border border-gray-200 bg-white/80 p-4 shadow-sm dark:border-white/15 dark:bg-white/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                    Amount
                  </p>
                  <p className="mt-1 text-lg font-semibold text-gray-950 dark:text-white">
                    UGX {req.amount.toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={req.status} />
              </div>
              <div className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-600 dark:border-white/10 dark:text-gray-300">
                {new Date(req.created_at).toLocaleDateString()}
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="border-y text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-300">
              <tr>
                <th className="py-3 font-semibold">Amount</th>
                <th className="py-3 font-semibold">Status</th>
                <th className="py-3 font-semibold">Date</th>
              </tr>
            </thead>

            <tbody>
              {data.map((req) => (
                <tr
                  key={req.id}
                  className="border-b text-gray-800 transition last:border-none hover:bg-brand-50/60 dark:text-gray-100 dark:hover:bg-white/5"
                >
                  <td className="py-4 font-medium">
                    UGX {req.amount.toLocaleString()}
                  </td>
                  <td className="py-4">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="py-4 text-gray-600 dark:text-gray-300">
                    {new Date(req.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-200",
    approved:
      "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-200",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
        map[status] ??
        "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200"
      }`}
    >
      {status}
    </span>
  );
}
