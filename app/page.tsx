import { redirect } from "next/navigation";
import { supabaseServer } from "./lib/supabase/server";
import type { MemberRow } from "./types/member";

export default async function HomePage() {
  const supabase = await supabaseServer();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, first_name, status, role")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<MemberRow>();

  if (member?.status === "approved") {
    redirect("/dashboard");
  }

  if (member?.status === "suspended") {
    redirect("/account-suspended");
  }

  redirect("/pending-approval");
}
