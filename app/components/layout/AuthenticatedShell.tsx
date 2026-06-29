import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppFrame } from "@/app/components/layout/AppFrame";
import { supabaseServer } from "@/app/lib/supabase/server";
import { Role } from "@/app/employee_type/roles";
import {
  isSidebarPosition,
  SidebarPosition,
} from "@/app/lib/preferences";

type ShellMember = {
  status: "pending" | "approved" | "suspended" | "denied";
  role: Role;
  sidebar_position: SidebarPosition | null;
};

type AuthenticatedShellProps = {
  children: ReactNode;
};

export async function AuthenticatedShell({
  children,
}: AuthenticatedShellProps) {
  const supabase = await supabaseServer();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: member } = await supabase
    .from("members")
    .select("status, role, sidebar_position")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<ShellMember>();

  if (member?.status === "suspended") {
    redirect("/account-suspended");
  }

  if (!member || member.status !== "approved") {
    redirect("/pending-approval");
  }

  const sidebarPosition = isSidebarPosition(member.sidebar_position)
    ? member.sidebar_position
    : "left";

  return (
    <AppFrame
      initialRole={member.role}
      initialUserId={session.user.id}
      initialSidebarPosition={sidebarPosition}
    >
      {children}
    </AppFrame>
  );
}
