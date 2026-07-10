import { assignMemberRole } from "@/app/actions/giefa";
import {
  getCurrentMember,
  getMembers,
  memberName,
} from "@/app/lib/giefa/liveData";
import { Role } from "@/app/employee_type/roles";

const leadershipRoles: Array<{ value: Role; label: string; detail: string }> = [
  {
    value: "chairman",
    label: "Chairman",
    detail: "Association leadership and governance oversight",
  },
  {
    value: "treasurer",
    label: "Treasurer",
    detail: "Finance reviews, reports, deposits, and fund operations",
  },
  {
    value: "general_sec",
    label: "General Secretary",
    detail: "Membership, suspensions, meetings, and administration",
  },
  {
    value: "member",
    label: "Member",
    detail: "Normal member access and personal fund activity",
  },
];

function roleLabel(role: string | null | undefined) {
  return role?.replace("_", " ") ?? "member";
}

export default async function ChairmanFinanceOverviewPage() {
  const [members, currentMember] = await Promise.all([
    getMembers("approved"),
    getCurrentMember(),
  ]);
  const activeMembers = members.filter((member) => member.status === "approved");
  const chairmen = activeMembers.filter((member) => member.role === "chairman");
  const treasurers = activeMembers.filter((member) => member.role === "treasurer");
  const secretaries = activeMembers.filter((member) => member.role === "general_sec");
  const regularMembers = activeMembers.filter((member) => member.role === "member");
  const canAssignRoles =
    currentMember?.status === "approved" &&
    ["chairman", "admin"].includes(currentMember.role);
  const actorIsAdmin = currentMember?.role === "admin";

  return (
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm sm:p-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
            Chairman
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Leadership & Role Oversight
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-200">
            Assign association roles to approved members and protect chairman
            continuity before leadership changes hands.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Approved Members",
            value: String(activeMembers.length),
            detail: "Available for role assignment",
          },
          {
            label: "Chairmen",
            value: String(chairmen.length),
            detail:
              chairmen.length > 0
                ? "Leadership coverage active"
                : "Admin override required",
          },
          {
            label: "Treasurers",
            value: String(treasurers.length),
            detail: "Finance operators",
          },
          {
            label: "General Secretaries",
            value: String(secretaries.length),
            detail: "Membership operators",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border bg-white p-5 shadow-sm dark:border-white/15 dark:bg-white/10"
          >
            <p className="text-sm text-gray-500 dark:text-gray-300">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
              {metric.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-white p-5 shadow-sm dark:border-white/15 dark:bg-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Succession Rule
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-200">
            A chairman should assign another approved member as chairman before
            resigning or appointing themselves to another role.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-100">
            <li className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-500" />
              Chairman cannot leave the association without another chairman.
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-500" />
              Admin can continue operating if chairman resigns unexpectedly.
            </li>
          </ul>
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm dark:border-white/15 dark:bg-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Immediate Access Refresh
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-200">
            If you change your own role, GIEFA redirects you to the dashboard so
            the sidebar, permissions, and page access refresh with the new role.
          </p>
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm dark:border-white/15 dark:bg-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Current Balance
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-200">
            {regularMembers.length} regular member
            {regularMembers.length === 1 ? "" : "s"} and{" "}
            {activeMembers.length - regularMembers.length} leadership/system
            user{activeMembers.length - regularMembers.length === 1 ? "" : "s"}.
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-lg border bg-white shadow-sm dark:border-white/15 dark:bg-white/10">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-white/15">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Assign Roles To Approved Members
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            Assign chairman, treasurer, general secretary, or member access.
          </p>
        </div>

        {!canAssignRoles ? (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-gray-200">
            Only chairman or admin can assign roles.
          </p>
        ) : activeMembers.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-gray-200">
            No approved members are available for assignment.
          </p>
        ) : (
          <>
          <div className="grid gap-3 p-3 sm:hidden">
            {activeMembers.map((member) => {
              const isSelf = member.id === currentMember?.id;
              const isOnlyChairman =
                member.role === "chairman" &&
                chairmen.length === 1 &&
                !actorIsAdmin;

              return (
                <article
                  key={member.id}
                  className="rounded-xl border border-gray-200 bg-white/80 p-4 shadow-sm dark:border-white/15 dark:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-gray-900 dark:text-white">
                        {memberName(member)}
                        {isSelf ? " (you)" : ""}
                      </p>
                      <p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-300">
                        {member.email ?? "No email"}
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold capitalize text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
                      {roleLabel(member.role)}
                    </span>
                  </div>

                  {isOnlyChairman && (
                    <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-100">
                      Assign another chairman before changing this role.
                    </p>
                  )}

                  <form action={assignMemberRole} className="mt-4 grid gap-3">
                    <input type="hidden" name="member_id" value={member.id} />
                    <label className="grid gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                      Assign role
                      <select
                        name="role"
                        defaultValue={member.role}
                        className="h-12 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/15 dark:bg-white/10 dark:text-white"
                      >
                        {leadershipRoles.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs leading-5 text-gray-500 dark:text-gray-300">
                      {
                        leadershipRoles.find((role) => role.value === member.role)
                          ?.detail
                      }
                    </p>
                    <button className="rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600">
                      Save Role
                    </button>
                  </form>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/5 dark:text-gray-200">
                <tr>
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Current Role</th>
                  <th className="px-5 py-3 font-semibold">Assign Role</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {activeMembers.map((member) => {
                  const isSelf = member.id === currentMember?.id;
                  const isOnlyChairman =
                    member.role === "chairman" &&
                    chairmen.length === 1 &&
                    !actorIsAdmin;

                  return (
                    <tr key={member.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {memberName(member)}
                          {isSelf ? " (you)" : ""}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                          {member.email ?? "No email"}
                        </p>
                      </td>
                      <td className="px-5 py-4 capitalize text-gray-700 dark:text-gray-100">
                        {roleLabel(member.role)}
                        {isOnlyChairman && (
                          <p className="mt-1 text-xs normal-case text-amber-600 dark:text-amber-200">
                            Assign another chairman before changing this role.
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <form
                          id={`assign-role-${member.id}`}
                          action={assignMemberRole}
                          className="flex min-w-56 flex-col gap-2"
                        >
                          <input type="hidden" name="member_id" value={member.id} />
                          <select
                            name="role"
                            defaultValue={member.role}
                            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/15 dark:bg-white/10 dark:text-white"
                          >
                            {leadershipRoles.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 dark:text-gray-300">
                            {
                              leadershipRoles.find((role) => role.value === member.role)
                                ?.detail
                            }
                          </p>
                        </form>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="submit"
                          form={`assign-role-${member.id}`}
                          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
                        >
                          Save Role
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
