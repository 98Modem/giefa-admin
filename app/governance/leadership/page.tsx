import { GeneralSecretaryTransferForm } from "@/app/components/governance/GeneralSecretaryTransferForm";
import {
  getGeneralSecretaryTransfers,
  getMembers,
  memberName,
} from "@/app/lib/giefa/liveData";

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function LeadershipGovernancePage() {
  const [members, transfers] = await Promise.all([
    getMembers("approved"),
    getGeneralSecretaryTransfers(),
  ]);
  const currentSecretary = members.find(
    (member) => member.role === "general_sec",
  );
  const candidates = members
    .filter((member) => member.role === "member")
    .map((member) => ({
      id: member.id,
      name: memberName(member),
      email: member.email,
    }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-gray-200 pb-5 dark:border-white/20">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
          Governance
        </p>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          General Secretary succession
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-200">
          Transfer authority in one audited action. GIEFA enforces exactly one
          approved General Secretary after every committed change.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Transfer General Secretary
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Only an approved Chairman or Admin can approve this action.
          </p>

          <div className="mt-5">
            {currentSecretary ? (
              <GeneralSecretaryTransferForm
                currentSecretary={{
                  id: currentSecretary.id,
                  name: memberName(currentSecretary),
                  email: currentSecretary.email,
                }}
                candidates={candidates}
              />
            ) : (
              <div className="rounded-lg bg-error-50 p-4 text-sm text-error-700 dark:bg-error-500/10 dark:text-error-300">
                No active General Secretary was found. An administrator must
                repair the leadership record before a transfer can proceed.
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Transfer history
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Immutable approval records retain names even if a member record is
              later removed.
            </p>
          </div>

          {transfers.length === 0 ? (
            <p className="px-5 py-10 text-sm text-gray-500 dark:text-gray-300">
              No General Secretary transfers have been recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/5 dark:text-gray-300">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Approved</th>
                    <th className="px-5 py-3 font-semibold">Transfer</th>
                    <th className="px-5 py-3 font-semibold">Approver</th>
                    <th className="px-5 py-3 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {transfers.map((transfer) => (
                    <tr key={transfer.id}>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-700 dark:text-gray-200">
                        {dateTimeLabel(transfer.approved_at)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {transfer.incoming_member_name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Replaced {transfer.outgoing_member_name}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-gray-700 dark:text-gray-200">
                        {transfer.approved_by_name}
                      </td>
                      <td className="min-w-64 px-5 py-4 text-gray-700 dark:text-gray-200">
                        {transfer.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
