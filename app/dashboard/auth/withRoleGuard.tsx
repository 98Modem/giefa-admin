"use client";

import { ComponentType, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "./useUserRole";
import { Role } from "@/app/employee_type/roles";

type WithRoleGuardOptions = {
  allowedRoles: Role[];
  redirectTo?: string;
};

export function withRoleGuard<P extends object>(
  WrappedComponent: ComponentType<P>,
  { allowedRoles, redirectTo = "/dashboard" }: WithRoleGuardOptions
) {
  const GuardedComponent = (props: P) => {
    const router = useRouter();
    const { role, loading } = useUserRole();

    useEffect(() => {
      if (!loading && role && !allowedRoles.includes(role)) {
        router.replace(redirectTo);
      }
    }, [role, loading, router]);

    if (loading) return null;
    if (!role || !allowedRoles.includes(role)) return null;

    return <WrappedComponent {...props} />;
  };

  GuardedComponent.displayName = `withRoleGuard(${
    WrappedComponent.displayName ||
    WrappedComponent.name ||
    "Component"
  })`;

  return GuardedComponent;
}
