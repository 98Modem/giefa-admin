import Image from "next/image";
import { redirect } from "next/navigation";
import {
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { supabaseServer } from "@/app/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

type SuspendedMember = {
  first_name: string | null;
  email: string | null;
  status: "pending" | "approved" | "suspended" | "denied";
};

export default async function AccountSuspendedPage() {
  const supabase = await supabaseServer();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: member } = await supabase
    .from("members")
    .select("first_name, email, status")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<SuspendedMember>();

  if (member?.status === "approved") {
    redirect("/dashboard");
  }

  if (member?.status !== "suspended") {
    redirect("/pending-approval");
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900 dark:bg-gray-950 dark:text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col justify-between bg-brand-950 p-8 text-white">
            <div>
              <Image
                src="/logo/giefa-auth-logo.png"
                alt="GIEFA"
                width={132}
                height={42}
                className="mb-10"
                priority
              />
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/10">
                <ShieldExclamationIcon className="h-7 w-7" aria-hidden="true" />
              </div>
            </div>

            <div className="mt-12">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand-200">
                Account status
              </p>
              <h1 className="mt-3 text-3xl font-semibold">
                Access suspended
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-brand-100/85">
                Your GIEFA dashboard access is temporarily restricted. The
                association leadership or system administrator must review and
                restore your account before you can continue.
              </p>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <div className="flex items-start gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
              <ExclamationTriangleIcon
                className="mt-0.5 h-6 w-6 shrink-0"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-base font-semibold">
                  Your account is suspended
                </h2>
                <p className="mt-1 text-sm leading-6">
                  You cannot access member dashboards, fund requests, reports,
                  or governance pages while this status is active.
                </p>
              </div>
            </div>

            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Member
                </dt>
                <dd className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                  {member.first_name || "GIEFA member"}
                </dd>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Status
                </dt>
                <dd className="mt-2">
                  <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold uppercase text-red-700 dark:bg-red-500/15 dark:text-red-300">
                    Suspended
                  </span>
                </dd>
              </div>
            </dl>

            <div className="mt-8 rounded-lg bg-gray-50 p-5 text-sm leading-6 text-gray-600 dark:bg-gray-950 dark:text-gray-300">
              Contact the General Secretary or an administrator if you believe
              this is a mistake. Once your account is reviewed and approved
              again, signing in will route you back to the dashboard
              automatically.
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <SignOutButton />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This will end the current session and open the login page.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
