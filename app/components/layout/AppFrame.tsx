"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import Sidebar from "@/app/components/sidebar/Sidebar";
import { Header } from "@/app/components/header/header";
import InactivityModal from "@/app/dashboard/components/InactivityModal";
import { useInactivityLogout } from "@/app/dashboard/hooks/useInactivityLogout";
import { useUserRole } from "@/app/dashboard/auth/useUserRole";
import { Role } from "@/app/employee_type/roles";
import {
  isSidebarPosition,
  SidebarPosition,
} from "@/app/lib/preferences";

type AppFrameProps = {
  children: ReactNode;
  initialRole: Role;
  initialUserId: string;
  initialSidebarPosition: SidebarPosition;
};

export function AppFrame({
  children,
  initialRole,
  initialUserId,
  initialSidebarPosition,
}: AppFrameProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarPosition, setSidebarPosition] = useState<SidebarPosition>(() => {
    if (typeof window === "undefined") return initialSidebarPosition;

    const stored = localStorage.getItem("giefa-sidebar-position");
    return isSidebarPosition(stored) ? stored : initialSidebarPosition;
  });
  const isFloating = sidebarPosition === "floating";
  const { showPrompt, countdown, continueSession } = useInactivityLogout();
  const {
    role: liveRole,
    userId: liveUserId,
    loading: roleLoading,
  } = useUserRole({
    initialRole,
    initialUserId,
  });
  const currentRole = liveRole ?? initialRole;
  const currentUserId = liveUserId ?? initialUserId;
  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  useEffect(() => {
    const handlePreferenceUpdate = (event: Event) => {
      const nextPosition = (event as CustomEvent<{
        sidebarPosition?: SidebarPosition;
      }>).detail?.sidebarPosition;

      if (isSidebarPosition(nextPosition)) {
        setSidebarPosition(nextPosition);
      }
    };

    window.addEventListener("giefa-preferences-updated", handlePreferenceUpdate);

    return () => {
      window.removeEventListener(
        "giefa-preferences-updated",
        handlePreferenceUpdate
      );
    };
  }, []);

  useEffect(() => {
    if (roleLoading || !currentRole) return;

    const protectedRoutes: Array<{ prefix: string; roles: Role[] }> = [
      { prefix: "/members", roles: ["general_sec", "chairman", "admin"] },
      { prefix: "/finance", roles: ["treasurer", "chairman", "admin"] },
      { prefix: "/governance", roles: ["chairman", "admin"] },
      { prefix: "/system", roles: ["chairman", "admin"] },
      { prefix: "/chairman", roles: ["chairman", "admin"] },
      { prefix: "/funds/pending", roles: ["treasurer", "chairman", "admin"] },
      { prefix: "/funds/approved", roles: ["treasurer", "chairman", "admin"] },
    ];

    const currentRoute = protectedRoutes.find((route) =>
      pathname.startsWith(route.prefix)
    );

    if (currentRoute && !currentRoute.roles.includes(currentRole)) {
      router.replace(`/dashboard?role_updated=${encodeURIComponent(currentRole)}`);
    }
  }, [currentRole, pathname, roleLoading, router]);

  return (
    <div
      className={clsx(
        "app-shell flex h-dvh min-h-0 w-full max-w-full overflow-hidden",
        sidebarPosition === "right" && "lg:flex-row-reverse"
      )}
    >
      <Sidebar
        role={currentRole}
        userId={currentUserId}
        loading={roleLoading && !currentRole}
        position={sidebarPosition}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={closeMobileSidebar}
      />

      <div
        className={clsx(
          "relative z-0 flex h-dvh min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden transition-[padding] duration-300",
          isFloating && "lg:pl-24"
        )}
      >
        <Header
          currentRole={currentRole}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="app-main min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>

      {showPrompt && (
        <InactivityModal
          countdown={countdown}
          onContinue={continueSession}
        />
      )}
    </div>
  );
}
