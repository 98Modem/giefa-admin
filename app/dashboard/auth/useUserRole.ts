"use client";

import { useEffect, useRef, useState } from "react";
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
  const roleRef = useRef<Role | null>(initialRole);

  useEffect(() => {
    let isMounted = true;
    let realtimeReady = false;
    let lastFetch = 0;

    const applyRole = (nextRole: Role, nextUserId: string) => {
      if (!isMounted) return;

      const previousRole = roleRef.current;
      roleRef.current = nextRole;
      setUserId(nextUserId);
      setRole(nextRole);
      setError(null);

      if (previousRole && previousRole !== nextRole) {
        window.dispatchEvent(
          new CustomEvent("giefa-role-updated", {
            detail: { role: nextRole, userId: nextUserId },
          })
        );
      }
    };

    const fetchRole = async (showLoading = false) => {
      try {
        lastFetch = Date.now();

        if (showLoading) {
          setLoading(true);
        }

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
          applyRole(data.role as Role, user.id);
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

    void fetchRole(!initialRole || !initialUserId);

    const channel = initialUserId
      ? supabaseBrowser
          .channel(`member-role:${initialUserId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "members",
              filter: `auth_user_id=eq.${initialUserId}`,
            },
            (payload) => {
              const changed = payload.new as { role?: Role };

              if (changed.role) {
                applyRole(changed.role, initialUserId);
                setLoading(false);
              }
            }
          )
          .subscribe((status) => {
            realtimeReady = status === "SUBSCRIBED";

            if (status === "SUBSCRIBED") {
              void fetchRole(false);
            }
          })
      : null;

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchRole(false);
      }
    };

    const fallbackInterval = window.setInterval(() => {
      const intervalMs = realtimeReady ? 30000 : 5000;

      if (Date.now() - lastFetch >= intervalMs) {
        void fetchRole(false);
      }
    }, 5000);

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      isMounted = false;
      window.clearInterval(fallbackInterval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);

      if (channel) {
        void supabaseBrowser.removeChannel(channel);
      }
    };
  }, [initialRole, initialUserId]);

  return { role, userId, loading, error };
}
