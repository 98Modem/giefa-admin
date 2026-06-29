"use client";

import { ReactNode, useEffect, useState } from "react";
import clsx from "clsx";
import Sidebar from "@/app/components/sidebar/Sidebar";
import { Header } from "@/app/components/header/header";
import InactivityModal from "@/app/dashboard/components/InactivityModal";
import { useInactivityLogout } from "@/app/dashboard/hooks/useInactivityLogout";
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
  const [sidebarPosition, setSidebarPosition] = useState<SidebarPosition>(() => {
    if (typeof window === "undefined") return initialSidebarPosition;

    const stored = localStorage.getItem("giefa-sidebar-position");
    return isSidebarPosition(stored) ? stored : initialSidebarPosition;
  });
  const isFloating = sidebarPosition === "floating";
  const { showPrompt, countdown, continueSession } = useInactivityLogout();

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

  return (
    <div
      className={clsx(
        "app-shell flex min-h-screen",
        sidebarPosition === "right" && "flex-row-reverse"
      )}
    >
      <Sidebar
        initialRole={initialRole}
        initialUserId={initialUserId}
        position={sidebarPosition}
      />

      <div
        className={clsx(
          "relative z-0 flex min-w-0 flex-1 flex-col transition-[padding] duration-300",
          isFloating && "lg:pl-24"
        )}
      >
        <Header />
        <main className="app-main min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5 lg:px-8 lg:py-7">
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
