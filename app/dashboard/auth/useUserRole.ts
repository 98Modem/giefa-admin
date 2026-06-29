"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/app/lib/supabase/client";

import { Role } from "@/app/employee_type/roles";

type UseUserRoleResult = {
  role: Role | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
};

type UseUserRoleOptions = {
  initialRole?: Role | null;
  initialUserId?: string | null;
};

export function useUserRole({
  initialRole = null,
  initialUserId = null,
}: UseUserRoleOptions = {}): UseUserRoleResult {
  const [role, setRole] = useState<Role | null>(initialRole);
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [loading, setLoading] = useState(!initialRole || !initialUserId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRole && initialUserId) {
      return;
    }

    let isMounted = true;

    const fetchRole = async () => {
      try {
        setLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabaseBrowser.auth.getUser();

        if (userError || !user) {
          throw new Error("User not authenticated");
        }

        const { data, error: roleError } = await supabaseBrowser
          .from("members")
          .select("role")
          .eq("auth_user_id", user.id)
          .single();

        if (roleError || !data?.role) {
          throw new Error("Role not found");
        }

        if (isMounted) {
          setUserId(user.id);
          setRole(data.role as Role);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load role"
          );
          setRole(null);
          setUserId(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRole();

    return () => {
      isMounted = false;
    };
  }, [initialRole, initialUserId]);

  return { role, userId, loading, error };
}
