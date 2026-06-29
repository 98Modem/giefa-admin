import { ReactNode } from "react";
import { AuthenticatedShell } from "@/app/components/layout/AuthenticatedShell";

export default function SystemLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
