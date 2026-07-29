import { redirect } from "next/navigation";

export default function ChairmanFinanceOverviewRedirect() {
  redirect("/governance/change-roles");
}
