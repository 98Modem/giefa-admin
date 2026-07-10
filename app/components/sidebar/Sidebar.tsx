"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";

import { supabaseBrowser } from "@/app/lib/supabase/client";
import { useUserRole } from "@/app/dashboard/auth/useUserRole";

import {
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

import { Role } from "@/app/employee_type/roles";
import { SidebarPosition } from "@/app/lib/preferences";

import {
  SIDEBAR_MENU,
  SidebarItem,
  SidebarSubItem,
} from "./sidebar.config";

/* -----------------------------------
 Tooltip
----------------------------------- */
function Tooltip({
  label,
  position,
}: {
  label: string;
  position: SidebarPosition;
}) {
  const opensLeft = position === "right";

  return (
    <span
      className={clsx(
        "absolute top-1/2 z-[120] -translate-y-1/2 whitespace-nowrap rounded-md bg-brand-950 px-3 py-1 text-xs text-white opacity-0 transition-opacity pointer-events-none group-hover:opacity-100",
        opensLeft ? "right-full mr-3" : "left-full ml-3"
      )}
    >
      <span
        className={clsx(
          "absolute top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-brand-950",
          opensLeft ? "-right-1" : "-left-1"
        )}
      />
      {label}
    </span>
  );
}

function SidebarLoadingShell({
  position = "left",
}: {
  position?: SidebarPosition;
}) {
  return (
    <aside
      className={clsx(
        "theme-sidebar fixed left-0 top-0 z-[80] flex h-screen w-[4.75rem] shrink-0 flex-col border-r lg:w-72.5",
        position === "floating"
          ? "lg:left-4 lg:top-4 lg:h-[calc(100vh-2rem)] lg:rounded-2xl lg:border lg:shadow-2xl"
          : "lg:sticky lg:top-0"
      )}
    >
      <div className="flex items-center justify-between px-4 pb-6 pt-6">
        <span className="text-xl font-bold tracking-wide">GIEFA</span>
        <div className="h-10 w-10 animate-pulse rounded-lg bg-white/15" />
      </div>

      <div className="flex flex-1 flex-col gap-2 px-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-10 animate-pulse rounded-lg bg-white/15"
          />
        ))}
      </div>

      <div className="theme-sidebar-footer mt-auto shrink-0 px-3 pb-4 pt-3">
        <div className="h-10 animate-pulse rounded-lg bg-white/15" />
      </div>
    </aside>
  );
}

type SidebarProps = {
  initialRole?: Role | null;
  initialUserId?: string | null;
  position?: SidebarPosition;
};

/* -----------------------------------
 Sidebar
----------------------------------- */
export default function Sidebar({
  initialRole = null,
  initialUserId = null,
  position = "left",
}: SidebarProps) {
  const pathname = usePathname();
  const { role, userId, loading } = useUserRole({
    initialRole,
    initialUserId,
  });

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;

    return window.matchMedia("(max-width: 1024px)").matches;
  });
  const [mounted, setMounted] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const sidebarStorageKey = userId
    ? `giefa-sidebar-collapsed:${userId}`
    : null;
  const isRight = position === "right";
  const isFloating = position === "floating";

  const isActive = (href?: string) =>
    href ? pathname === href || pathname.startsWith(href) : false;

  /* -----------------------------------
   Sidebar responsive state
  ----------------------------------- */
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)");

    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setCollapsed(true);
      }
    };

    media.addEventListener("change", handleChange);
    const mountedTimer = window.setTimeout(() => setMounted(true), 0);

    return () => {
      window.clearTimeout(mountedTimer);
      media.removeEventListener("change", handleChange);
    };
  }, [sidebarStorageKey]);

  useEffect(() => {
    if (!mounted || !sidebarStorageKey) return;

    const storageTimer = window.setTimeout(() => {
      if (window.matchMedia("(max-width: 1024px)").matches) {
        setCollapsed(true);
        setStorageReady(true);
        return;
      }

      const saved = localStorage.getItem(sidebarStorageKey);

      if (saved !== null) {
        setCollapsed(saved === "true");
      }

      setStorageReady(true);
    }, 0);

    return () => window.clearTimeout(storageTimer);
  }, [mounted, sidebarStorageKey]);

  useEffect(() => {
    if (mounted && storageReady && sidebarStorageKey) {
      if (window.matchMedia("(max-width: 1024px)").matches) return;

      localStorage.setItem(sidebarStorageKey, String(collapsed));
    }
  }, [collapsed, mounted, sidebarStorageKey, storageReady]);

  if (loading || !role) return <SidebarLoadingShell position={position} />;

  /* -----------------------------------
   Logout
  ----------------------------------- */
  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await supabaseBrowser.auth.signOut({ scope: "global" });
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed:", err);
      setLoggingOut(false);
    }
  };

  /* -----------------------------------
   Render
  ----------------------------------- */
  return (
    <>
      {!collapsed && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px] lg:hidden"
          onClick={() => {
            setOpenMenu(null);
            setCollapsed(true);
          }}
        />
      )}
      <aside
        className={clsx(
          "theme-sidebar fixed left-0 top-0 z-[80] flex h-screen shrink-0 flex-col overflow-visible transition-all duration-300 lg:sticky lg:top-0",
          isFloating
            ? "theme-sidebar-floating lg:left-4 lg:top-4 lg:h-[calc(100vh-2rem)] lg:rounded-2xl lg:border"
            : clsx("border-r", isRight && "lg:border-l lg:border-r-0"),
          collapsed ? "w-[4.75rem] lg:w-22.5" : "w-[min(18.125rem,82vw)] lg:w-72.5"
        )}
      >
      <div
        className={clsx(
          "px-4 pb-4 pt-5",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <div
          className={clsx(
            "flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-base font-bold tracking-wide text-white">
                GIEFA
              </p>
              <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
                Cooperative banking
              </p>
            </div>
          )}
          <button
            onClick={() => {
              setOpenMenu(null);
              setCollapsed(!collapsed);
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/75 transition hover:bg-white/[0.12] hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav
        className={clsx(
          "custom-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 px-3 pb-4 pt-1",
          collapsed ? "overflow-visible" : "overflow-y-auto"
        )}
      >
        {SIDEBAR_MENU
          .filter((item: SidebarItem) =>
            item.roles.includes(role as Role)
          )
          .map((item: SidebarItem) => {
            const Icon = item.icon;
            const visibleSubItems =
              item.subMenu?.filter(
                (sub: SidebarSubItem) =>
                  !sub.roles || sub.roles.includes(role as Role)
              ) ?? [];

            const itemActive =
              isActive(item.href) ||
              visibleSubItems.some((sub) =>
                isActive(sub.href)
              );

            const isOpen = !collapsed && (openMenu === item.key || itemActive);
            const isFlyoutOpen = collapsed && openMenu === item.key;

            return (
              <div
                key={item.key}
                className="group relative z-[90]"
                onMouseEnter={() => {
                  if (collapsed && visibleSubItems.length > 0) {
                    setOpenMenu(item.key);
                  }
                }}
                onMouseLeave={() => {
                  if (collapsed && openMenu === item.key) {
                    setOpenMenu(null);
                  }
                }}
                onFocus={() => {
                  if (collapsed && visibleSubItems.length > 0) {
                    setOpenMenu(item.key);
                  }
                }}
              >
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={() => setOpenMenu(null)}
                    className={clsx(
                      "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition-all duration-200",
                      itemActive
                        ? "bg-white/[0.16] text-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/15"
                        : "text-white/70 hover:bg-white/[0.09] hover:text-white"
                    )}
                  >
                    {itemActive && (
                      <span
                        className={clsx(
                          "absolute top-2 bottom-2 w-1 rounded-full bg-brand-300",
                          isRight ? "right-1" : "left-1"
                        )}
                      />
                    )}
                    <span
                      className={clsx(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                        itemActive
                          ? "bg-white/[0.14] text-white"
                          : "text-white/70 group-hover:bg-white/10 group-hover:text-white"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      if (collapsed) {
                        setOpenMenu(item.key);
                        return;
                      }

                      setOpenMenu(isOpen ? null : item.key);
                    }}
                    aria-expanded={collapsed ? isFlyoutOpen : isOpen}
                    className={clsx(
                      "relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-semibold transition-all duration-200",
                      itemActive
                        ? "bg-white/[0.16] text-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/15"
                        : "text-white/70 hover:bg-white/[0.09] hover:text-white"
                    )}
                  >
                    {itemActive && (
                      <span
                        className={clsx(
                          "absolute top-2 bottom-2 w-1 rounded-full bg-brand-300",
                          isRight ? "right-1" : "left-1"
                        )}
                      />
                    )}
                    <span
                      className={clsx(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                        itemActive
                          ? "bg-white/[0.14] text-white"
                          : "text-white/70 group-hover:bg-white/10 group-hover:text-white"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    {!collapsed && <span className="truncate">{item.title}</span>}
                    {!collapsed && (
                      <ChevronRightIcon
                        className={clsx(
                          "ml-auto h-4 w-4 text-white/45 transition-transform",
                          isOpen && "rotate-90"
                        )}
                      />
                    )}
                  </button>
                )}

                {collapsed && visibleSubItems.length === 0 && (
                  <Tooltip label={item.title} position={position} />
                )}

                {collapsed && visibleSubItems.length > 0 && (
                  <div
                    className={clsx(
                      "pointer-events-none invisible absolute top-1/2 z-[120] w-68 opacity-0 transition-all duration-200 ease-out",
                      position === "right"
                        ? "right-full origin-right pr-4 translate-x-2 -translate-y-1/2 scale-95"
                        : "left-full origin-left pl-4 -translate-x-2 -translate-y-1/2 scale-95",
                      position === "right"
                        ? "group-hover:pointer-events-auto group-hover:visible group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-x-0 group-focus-within:scale-100 group-focus-within:opacity-100"
                        : "group-hover:pointer-events-auto group-hover:visible group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-x-0 group-focus-within:scale-100 group-focus-within:opacity-100",
                      isFlyoutOpen &&
                        "pointer-events-auto visible translate-x-0 scale-100 opacity-100"
                    )}
                  >
                    <div
                      className={clsx(
                        "absolute top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-[var(--app-border)] bg-[var(--app-surface-strong)]",
                        position === "right"
                          ? "right-2 border-r border-t"
                          : "left-2 border-b border-l"
                      )}
                    />
                    <div className="theme-sidebar-panel relative overflow-hidden rounded-lg border p-2 shadow-2xl ring-1 ring-white/10">
                      <div className="absolute inset-x-0 top-0 h-1 bg-brand-500" />
                      <div className="px-3 pb-2 pt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-500 dark:text-brand-300">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                          {visibleSubItems.length} option
                          {visibleSubItems.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ul className="flex flex-col gap-1 border-t border-gray-100 pt-2 dark:border-white/10">
                        {visibleSubItems.map((sub: SidebarSubItem) => (
                          <li key={sub.href}>
                            <Link
                              href={sub.href}
                              onClick={() => setOpenMenu(null)}
                              className={clsx(
                                "group/sub flex items-center justify-between rounded-md px-3 py-2.5 text-sm leading-5 transition-all duration-150",
                                isActive(sub.href)
                                  ? "bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-100 dark:bg-brand-500/20 dark:text-white dark:ring-brand-400/20"
                                  : "text-gray-700 hover:bg-brand-50 hover:pl-4 hover:text-brand-700 dark:text-gray-100 dark:hover:bg-white/10 dark:hover:text-white"
                              )}
                            >
                              <span>{sub.title}</span>
                              <ChevronRightIcon
                                className={clsx(
                                  "h-3.5 w-3.5 transition-all",
                                  isActive(sub.href)
                                    ? "text-brand-500 opacity-100"
                                    : "text-gray-400 opacity-0 group-hover/sub:translate-x-0.5 group-hover/sub:opacity-100"
                                )}
                                aria-hidden="true"
                              />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {visibleSubItems.length > 0 && !collapsed && (
                  <div
                    className={clsx(
                      "grid transition-all duration-200 ease-out",
                      isRight
                        ? "mr-8 border-r border-white/15 pr-2"
                        : "ml-8 border-l border-white/15 pl-2",
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <ul className="min-h-0 space-y-1 overflow-hidden">
                      {visibleSubItems.map((sub: SidebarSubItem) => (
                          <li key={sub.href}>
                            <Link
                              href={sub.href}
                              onClick={() => setOpenMenu(null)}
                              className={clsx(
                                "block rounded-lg px-3 py-2 text-sm leading-5 transition-all duration-150",
                                isActive(sub.href)
                                  ? "bg-white/[0.14] font-semibold text-white"
                                  : "text-white/[0.58] hover:bg-white/[0.09] hover:text-white"
                              )}
                            >
                              {sub.title}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
      </nav>

      <div className="theme-sidebar-footer mt-auto shrink-0 px-3 pb-4 pt-3">
        <div className="mb-3 h-px bg-white/10" />
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Logout"
          className={clsx(
            "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 font-medium transition",
            collapsed && "justify-center",
            loggingOut
              ? "cursor-not-allowed text-white/40"
              : "text-red-100 hover:bg-red-500/15 hover:text-white hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
          )}
        >
          <ArrowLeftOnRectangleIcon className="h-6 w-6" />
          {!collapsed && (
            <span>
              {loggingOut ? "Logging out..." : "Logout"}
            </span>
          )}
        </button>
      </div>
      </aside>
    </>
  );
}
