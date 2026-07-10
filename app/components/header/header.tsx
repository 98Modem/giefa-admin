"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightOnRectangleIcon,
  BellIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SunIcon,
  SwatchIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { supabaseBrowser } from "@/app/lib/supabase/client";
import {
  colorThemes,
  ColorTheme,
  isColorTheme,
  isThemeMode,
  themeModes,
  ThemeMode,
} from "@/app/lib/preferences";
import { saveLocalPreferences } from "@/app/components/theme/ThemeProvider";
import { SIDEBAR_MENU } from "@/app/components/sidebar/sidebar.config";
import { Role } from "@/app/employee_type/roles";
import { GiefaAssistant } from "@/app/components/assistant/GiefaAssistant";

type HeaderMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  avatar_url: string | null;
  avatar_position_x: number | null;
  avatar_position_y: number | null;
  theme_mode: ThemeMode | null;
  color_theme: ColorTheme | null;
};

type HeaderNotification = {
  id: string;
  title?: string | null;
  message: string | null;
  type?: string | null;
  link_url?: string | null;
  read: boolean | null;
  created_at: string | null;
};

type SearchDestination = {
  title: string;
  group: string;
  href: string;
  keywords: string;
  roles: Role[];
};

const LIVE_DATA_TABLES = [
  "members",
  "monthly_contributions",
  "emergency_funds",
  "shares",
  "emergency_requests",
  "deposit_submissions",
  "bank_statement_imports",
  "bank_statement_transactions",
  "finance_monthly_reports",
  "finance_interest_allocations",
  "finance_report_edit_requests",
] as const;

const SEARCH_KEYWORDS: Record<string, string> = {
  "/dashboard": "home overview summary balances growth chart fund breakdown contributions",
  "/dashboard/profile": "profile avatar photo picture preferences theme color sidebar account settings",
  "/account/emergency-fund": "emergency balance savings personal fund member",
  "/account/investment-fund": "investment shares balance interest personal fund member",
  "/account/interest": "interest earned profit return growth allocation member",
  "/funds/deposit-proof": "upload proof contribution evidence screenshot bank deposit payment scan ocr ai",
  "/funds/request": "request emergency fund withdraw application cash assistance",
  "/funds/my-requests": "my requests status history emergency fund applications",
  "/funds/pending": "pending requests approve reject treasurer emergency",
  "/funds/approved": "approved requests paid completed emergency",
  "/finance/deposit-submissions": "deposit reviews approve reject proof member contributions treasurer",
  "/finance/monthly-savings": "monthly savings contributions deposits member ledgers",
  "/finance/interest-growth": "interest growth returns profit allocation investment",
  "/finance/statement-reports": "statement reports bank statement upload pdf monthly close edit request approval",
  "/finance/reports": "financial reports analytics finance monthly",
  "/members/pending": "pending applications approve deny new users signup general secretary",
  "/members/active": "active members approved users membership",
  "/members/suspended": "suspended members restore suspension blocked",
  "/members/meetings": "meetings schedule governance calendar secretary",
  "/chairman/finance-overview": "chairman overview finance governance totals",
  "/chairman/finance-reports": "chairman reports approve edit review monthly statement",
  "/governance/activity-logs": "activity logs audit governance actions history",
  "/governance/deletion-approvals": "deletion approvals suspension reviews restore keep suspended",
  "/system/users": "users roles admin manage members permissions",
  "/system/permissions": "permissions access control roles admin",
  "/system/audit-logs": "audit logs system history admin",
  "/system/settings": "settings system configuration admin",
};

const profileDestination: SearchDestination = {
  title: "Profile, photo, and preferences",
  group: "My Account",
  href: "/dashboard/profile",
  keywords: SEARCH_KEYWORDS["/dashboard/profile"],
  roles: ["admin", "chairman", "general_sec", "treasurer", "member"],
};

function buildSearchDestinations(role: Role | null | undefined) {
  const currentRole = role ?? "member";
  const destinations: SearchDestination[] = [];

  for (const item of SIDEBAR_MENU) {
    if (!item.roles.includes(currentRole)) continue;

    if (item.href) {
      destinations.push({
        title: item.title,
        group: "Navigation",
        href: item.href,
        keywords: `${item.title} ${item.href} ${SEARCH_KEYWORDS[item.href] ?? ""}`,
        roles: item.roles,
      });
    }

    for (const subItem of item.subMenu ?? []) {
      const allowedRoles = subItem.roles ?? item.roles;
      if (!allowedRoles.includes(currentRole)) continue;

      destinations.push({
        title: subItem.title,
        group: item.title,
        href: subItem.href,
        keywords: `${item.title} ${subItem.title} ${subItem.href} ${
          SEARCH_KEYWORDS[subItem.href] ?? ""
        }`,
        roles: allowedRoles,
      });
    }
  }

  if (profileDestination.roles.includes(currentRole)) {
    destinations.push(profileDestination);
  }

  return destinations;
}

function scoreDestination(destination: SearchDestination, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const title = destination.title.toLowerCase();
  const group = destination.group.toLowerCase();
  const href = destination.href.toLowerCase();
  const keywords = destination.keywords.toLowerCase();

  if (!normalizedQuery) return 0;
  if (href === normalizedQuery) return 100;
  if (title === normalizedQuery) return 90;
  if (title.startsWith(normalizedQuery)) return 80;
  if (group.startsWith(normalizedQuery)) return 68;
  if (href.includes(normalizedQuery)) return 62;
  if (keywords.includes(normalizedQuery)) return 50;

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const matchedTerms = terms.filter((term) => keywords.includes(term)).length;

  return matchedTerms > 0 ? 28 + matchedTerms * 8 : 0;
}

export function Header() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [member, setMember] = useState<HeaderMember | null>(null);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [colorTheme, setColorTheme] = useState<ColorTheme>("blue");
  const closeTimerRef = useRef<number | null>(null);
  const notificationCloseTimerRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const lastNotificationRefreshRef = useRef(0);
  const pageRefreshTimerRef = useRef<number | null>(null);
  const lastPageRefreshRef = useRef(0);

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openMenu = () => {
    cancelClose();
    setOpen(true);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 180);
  };

  const cancelNotificationClose = () => {
    if (notificationCloseTimerRef.current !== null) {
      window.clearTimeout(notificationCloseTimerRef.current);
      notificationCloseTimerRef.current = null;
    }
  };

  const openNotifications = () => {
    cancelNotificationClose();
    setNotificationsOpen(true);
  };

  const scheduleNotificationClose = () => {
    cancelNotificationClose();
    notificationCloseTimerRef.current = window.setTimeout(() => {
      setNotificationsOpen(false);
      notificationCloseTimerRef.current = null;
    }, 180);
  };

  const schedulePageRefresh = useCallback(() => {
    if (document.visibilityState !== "visible") return;

    if (pageRefreshTimerRef.current !== null) {
      window.clearTimeout(pageRefreshTimerRef.current);
    }

    pageRefreshTimerRef.current = window.setTimeout(() => {
      lastPageRefreshRef.current = Date.now();
      router.refresh();
      pageRefreshTimerRef.current = null;
    }, 700);
  }, [router]);

  useEffect(() => {
    const loadMember = async () => {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser();

      if (!user) return;

      const { data } = await supabaseBrowser
        .from("members")
        .select("id, first_name, last_name, role, avatar_url, avatar_position_x, avatar_position_y, theme_mode, color_theme")
        .eq("auth_user_id", user.id)
        .maybeSingle<HeaderMember>();

      if (!data) return;

      setMember(data);

      const nextThemeMode = isThemeMode(data.theme_mode)
        ? data.theme_mode
        : "system";
      const nextColorTheme = isColorTheme(data.color_theme)
        ? data.color_theme
        : "blue";

      setThemeMode(nextThemeMode);
      setColorTheme(nextColorTheme);
      saveLocalPreferences(nextThemeMode, nextColorTheme);
    };

    loadMember();

    window.addEventListener("giefa-profile-updated", loadMember);

    return () => {
      window.removeEventListener("giefa-profile-updated", loadMember);
    };
  }, []);

  useEffect(() => {
    const closeSearch = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", closeSearch);

    return () => {
      document.removeEventListener("mousedown", closeSearch);
    };
  }, []);

  const loadNotifications = useCallback(async (memberId: string, includeRead = false) => {
    lastNotificationRefreshRef.current = Date.now();

    let query = supabaseBrowser
      .from("notifications")
      .select("id, title, message, type, link_url, read, created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(12);

    if (!includeRead) {
      query = query.eq("read", false);
    }

    const { data, error } = await query;

    if (error) {
      let fallbackQuery = supabaseBrowser
        .from("notifications")
        .select("id, message, read, created_at")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(12);

      if (!includeRead) {
        fallbackQuery = fallbackQuery.eq("read", false);
      }

      const { data: fallback } = await fallbackQuery;

      setNotifications((fallback ?? []) as HeaderNotification[]);
      return;
    }

    setNotifications((data ?? []) as HeaderNotification[]);
  }, []);

  useEffect(() => {
    if (!member?.id) return;

    let mounted = true;
    let realtimeReady = false;

    const refreshIfMounted = async () => {
      if (!mounted || !member.id) return;
      await loadNotifications(member.id, showAllNotifications);
    };

    void refreshIfMounted();

    const channel = supabaseBrowser
      .channel(`notifications:${member.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `member_id=eq.${member.id}`,
        },
        (payload) => {
          const incoming = payload.new as HeaderNotification;

          setNotifications((current) => {
            if (incoming.read && !showAllNotifications) {
              return current.filter((notification) => notification.id !== incoming.id);
            }

            return [
              incoming,
              ...current.filter((notification) => notification.id !== incoming.id),
            ].slice(0, 12);
          });
          schedulePageRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `member_id=eq.${member.id}`,
        },
        (payload) => {
          const changed = payload.new as HeaderNotification;

          setNotifications((current) => {
            if (changed.read && !showAllNotifications) {
              return current.filter((notification) => notification.id !== changed.id);
            }

            if (current.some((notification) => notification.id === changed.id)) {
              return current.map((notification) =>
                notification.id === changed.id ? changed : notification
              );
            }

            return [changed, ...current].slice(0, 12);
          });
          schedulePageRefresh();
        }
      )
      .subscribe((status) => {
        realtimeReady = status === "SUBSCRIBED";

        if (status === "SUBSCRIBED") {
          void refreshIfMounted();
        }
      });

    const fallbackInterval = window.setInterval(() => {
      if (!mounted) return;

      const intervalMs = realtimeReady ? 30000 : 5000;
      if (Date.now() - lastNotificationRefreshRef.current >= intervalMs) {
        void refreshIfMounted();
      }
    }, 5000);

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        void refreshIfMounted();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      mounted = false;
      window.clearInterval(fallbackInterval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      supabaseBrowser.removeChannel(channel);
    };
  }, [loadNotifications, member?.id, schedulePageRefresh, showAllNotifications]);

  useEffect(() => {
    if (!member?.id) return;

    let mounted = true;
    let channel = supabaseBrowser.channel(`live-page-data:${member.id}`);

    LIVE_DATA_TABLES.forEach((table) => {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
        },
        () => {
          if (mounted) {
            schedulePageRefresh();
          }
        }
      );
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        lastPageRefreshRef.current = Date.now();
      }
    });

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        schedulePageRefresh();
      }
    };

    const safetyInterval = window.setInterval(() => {
      if (
        mounted &&
        document.visibilityState === "visible" &&
        Date.now() - lastPageRefreshRef.current > 45000
      ) {
        schedulePageRefresh();
      }
    }, 15000);

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      mounted = false;
      window.clearInterval(safetyInterval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);

      if (pageRefreshTimerRef.current !== null) {
        window.clearTimeout(pageRefreshTimerRef.current);
        pageRefreshTimerRef.current = null;
      }

      supabaseBrowser.removeChannel(channel);
    };
  }, [member?.id, schedulePageRefresh]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    return () => {
      cancelClose();
      cancelNotificationClose();

      if (pageRefreshTimerRef.current !== null) {
        window.clearTimeout(pageRefreshTimerRef.current);
      }
    };
  }, []);

  const savePreferences = async (
    nextThemeMode: ThemeMode,
    nextColorTheme: ColorTheme
  ) => {
    setThemeMode(nextThemeMode);
    setColorTheme(nextColorTheme);
    saveLocalPreferences(nextThemeMode, nextColorTheme);

    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser();

    if (!user) return;

  await supabaseBrowser.rpc("update_member_preferences_v2", {
    p_avatar_url: null,
    p_avatar_position_x: null,
    p_avatar_position_y: null,
    p_theme_mode: nextThemeMode,
    p_color_theme: nextColorTheme,
    p_sidebar_position: null,
  });
};

  const logout = async () => {
    await supabaseBrowser.auth.signOut();
    router.replace("/login");
  };

  const getNotificationHref = (notification: HeaderNotification) => {
    if (notification.link_url) return notification.link_url;

    const normalizedType = (notification.type ?? "").toLowerCase();
    const normalizedMessage = (notification.message ?? "").toLowerCase();

    if (normalizedType.includes("finance_report") || normalizedMessage.includes("report edit")) {
      return role === "chairman" || role === "admin"
        ? "/chairman/finance-reports"
        : "/finance/statement-reports";
    }

    if (normalizedType.includes("deposit") || normalizedMessage.includes("deposit proof")) {
      return role === "treasurer" || role === "admin" || role === "chairman"
        ? "/finance/deposit-submissions"
        : "/funds/deposit-proof";
    }

    if (normalizedMessage.includes("emergency")) return "/funds/my-requests";
    if (normalizedMessage.includes("pending approval")) return "/pending-approval";

    return "/dashboard";
  };

  const openNotification = async (notification: HeaderNotification) => {
    setNotificationsOpen(false);
    setNotifications((current) =>
      showAllNotifications
        ? current.map((item) =>
            item.id === notification.id ? { ...item, read: true } : item
          )
        : current.filter((item) => item.id !== notification.id)
    );

    if (!notification.read) {
      await supabaseBrowser
        .from("notifications")
        .update({ read: true })
        .eq("id", notification.id);
    }

    router.push(getNotificationHref(notification));
  };

  const toggleNotificationView = async () => {
    if (!member?.id) return;

    const nextShowAll = !showAllNotifications;
    setShowAllNotifications(nextShowAll);
    await loadNotifications(member.id, nextShowAll);
  };

  const clearNotifications = async () => {
    if (!member?.id || notifications.length === 0) return;

    const unreadIds = notifications
      .filter((notification) => !notification.read)
      .map((notification) => notification.id);

    if (unreadIds.length === 0) return;

    setNotifications((current) =>
      showAllNotifications
        ? current.map((notification) =>
            unreadIds.includes(notification.id)
              ? { ...notification, read: true }
              : notification
          )
        : current.filter((notification) => !unreadIds.includes(notification.id))
    );

    await supabaseBrowser
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds);
  };

  const displayName =
    [member?.first_name, member?.last_name].filter(Boolean).join(" ") ||
    "GIEFA user";
  const role = member?.role?.replace("_", " ") ?? "member";
  const memberRole = member?.role as Role | null | undefined;
  const searchDestinations = useMemo(
    () => buildSearchDestinations(memberRole),
    [memberRole]
  );
  const searchResults = useMemo(() => {
    const query = searchQuery.trim();

    if (!query) return searchDestinations.slice(0, 6);

    return searchDestinations
      .map((destination) => ({
        destination,
        score: scoreDestination(destination, query),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.destination.title.localeCompare(b.destination.title))
      .map((result) => result.destination)
      .slice(0, 8);
  }, [searchDestinations, searchQuery]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const avatarPosition = `${member?.avatar_position_x ?? 50}% ${
    member?.avatar_position_y ?? 50
  }%`;

  const openSearchDestination = (destination: SearchDestination) => {
    setSearchQuery("");
    setSearchOpen(false);
    setSelectedSearchIndex(0);
    router.push(destination.href);
  };

  const submitSearch = () => {
    const query = searchQuery.trim();

    if (query.startsWith("/")) {
      setSearchQuery("");
      setSearchOpen(false);
      router.push(query);
      return;
    }

    if (searchResults[0]) {
      openSearchDestination(searchResults[0]);
    }
  };

  return (
    <header className="theme-header sticky top-0 z-40 flex w-full border-b px-3 py-3 sm:px-4">
      <div className="flex flex-1 flex-wrap items-center gap-2 sm:gap-3">
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-gray-800 dark:text-white sm:text-lg lg:flex-none">
          GIEFA Dashboard
        </h1>

        <div
          ref={searchRef}
          className="relative order-3 flex w-full flex-1 justify-center sm:order-none sm:mx-2 sm:w-auto lg:mx-3"
        >
          <form
            className="w-full max-w-xl sm:min-w-52"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <div className="relative">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchOpen(true);
                  setSelectedSearchIndex(0);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSelectedSearchIndex((current) =>
                      Math.min(current + 1, Math.max(searchResults.length - 1, 0))
                    );
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSelectedSearchIndex((current) => Math.max(current - 1, 0));
                  }

                  if (event.key === "Escape") {
                    setSearchOpen(false);
                  }

                  if (event.key === "Enter" && searchResults[selectedSearchIndex]) {
                    event.preventDefault();
                    openSearchDestination(searchResults[selectedSearchIndex]);
                  }
                }}
                placeholder="Search members, deposits, reports, settings..."
                className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] pl-10 pr-4 text-sm font-medium text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 dark:text-white sm:h-11"
                aria-label="Search GIEFA"
              />
            </div>
          </form>

          {searchOpen && (
            <div className="absolute top-full mt-2 w-full max-w-xl overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
              <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {searchQuery.trim() ? "Search results" : "Quick destinations"}
                </p>
              </div>
              <div className="max-h-96 overflow-y-auto p-2">
                {searchResults.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-300">
                    No matching place found. Try &quot;deposit&quot;, &quot;members&quot;, &quot;reports&quot;, or type a URL like /dashboard.
                  </p>
                ) : (
                  searchResults.map((destination, index) => (
                    <button
                      key={destination.href}
                      type="button"
                      onMouseEnter={() => setSelectedSearchIndex(index)}
                      onClick={() => openSearchDestination(destination)}
                      className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                        selectedSearchIndex === index
                          ? "bg-brand-50 text-brand-900 dark:bg-white/10 dark:text-white"
                          : "text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-white/10"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {destination.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                          {destination.group}
                        </span>
                      </span>
                      <span className="hidden rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-300 xl:block">
                        {destination.href}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <GiefaAssistant destinations={searchDestinations} />

          <div
            ref={notificationRef}
            className="relative"
            onMouseEnter={openNotifications}
            onMouseLeave={scheduleNotificationClose}
            onFocus={openNotifications}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                scheduleNotificationClose();
              }
            }}
          >
            <button
              type="button"
              onClick={() => {
                cancelNotificationClose();
                setNotificationsOpen((current) => !current);
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] text-gray-700 shadow-sm transition hover:bg-brand-50 dark:text-gray-100 dark:hover:bg-white/10 sm:h-11 sm:w-11"
              aria-label="Open notifications"
              aria-expanded={notificationsOpen}
            >
              <BellIcon className="h-5 w-5" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-7rem)] max-w-96 origin-top-right overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] shadow-2xl ring-1 ring-black/5 dark:ring-white/10 sm:w-96">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Notifications
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {showAllNotifications
                        ? `${notifications.length} recent`
                        : `${unreadCount} unread`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearNotifications}
                    disabled={unreadCount === 0}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-200 dark:hover:bg-white/10"
                  >
                    Clear all
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-300">
                      {showAllNotifications
                        ? "No notifications yet."
                        : "No unread notifications."}
                    </p>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="grid w-full gap-1 rounded-lg px-3 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-white/10"
                      >
                        <span className="flex items-center gap-2">
                          {!notification.read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                          )}
                          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {notification.title || "GIEFA update"}
                          </span>
                        </span>
                        <span className="line-clamp-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
                          {notification.message || "Open this notification."}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div className="grid border-t border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={toggleNotificationView}
                    className="px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                  >
                    {showAllNotifications ? "Show only unread" : "Show all"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            ref={menuRef}
            className="relative"
            onMouseEnter={openMenu}
            onMouseLeave={scheduleClose}
            onFocus={openMenu}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                scheduleClose();
              }
            }}
          >
            <button
              type="button"
              onClick={() => {
                cancelClose();
                setOpen((current) => !current);
              }}
              className="flex h-10 items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-left shadow-sm transition hover:bg-brand-50 dark:hover:bg-white/10 sm:h-11 sm:gap-3 sm:pr-3"
              aria-expanded={open}
              aria-label="Open system menu"
            >
              <div
                className="h-7 w-7 rounded-full border border-gray-200 bg-cover bg-center bg-gray-100 dark:border-gray-700 dark:bg-gray-800 sm:h-8 sm:w-8"
                style={{
                  backgroundImage: `url(${member?.avatar_url || "/user/owner.jpg"})`,
                  backgroundPosition: avatarPosition,
                }}
              />
              <div className="hidden min-w-0 sm:block">
                <p className="max-w-36 truncate text-sm font-semibold text-gray-800 dark:text-white">
                  {displayName}
                </p>
                <p className="text-xs capitalize text-gray-500 dark:text-gray-400">
                  {role}
                </p>
              </div>
              <ChevronDownIcon
                className={`hidden h-4 w-4 text-gray-400 transition xsm:block ${
                  open ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-7rem)] max-w-80 origin-top-right rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-strong)] p-3 shadow-xl ring-1 ring-black/5 transition dark:ring-white/10 sm:w-80">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
                  <div
                    className="h-11 w-11 rounded-full border border-gray-200 bg-cover bg-center bg-gray-100 dark:border-gray-700"
                    style={{
                      backgroundImage: `url(${member?.avatar_url || "/user/owner.jpg"})`,
                      backgroundPosition: avatarPosition,
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {displayName}
                    </p>
                    <p className="text-xs capitalize text-gray-500 dark:text-gray-400">
                      {role}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 py-3">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <Cog6ToothIcon className="h-4 w-4" aria-hidden="true" />
                      Appearance
                    </div>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                      {themeModes.map((mode) => (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => savePreferences(mode.value, colorTheme)}
                          className={`flex h-9 items-center justify-center gap-1 rounded-md text-xs font-semibold transition ${
                            themeMode === mode.value
                              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                              : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                          }`}
                        >
                          {mode.value === "dark" ? (
                            <MoonIcon className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <SunIcon className="h-4 w-4" aria-hidden="true" />
                          )}
                          {mode.value === "system" ? "Auto" : mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <SwatchIcon className="h-4 w-4" aria-hidden="true" />
                      Color theme
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {colorThemes.map((theme) => (
                        <button
                          key={theme.value}
                          type="button"
                          onClick={() => savePreferences(themeMode, theme.value)}
                          className={`h-8 w-8 rounded-full border-2 transition ${
                            colorTheme === theme.value
                              ? "border-gray-900 dark:border-white"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: theme.swatch }}
                          aria-label={`Use ${theme.label} accent`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1 border-t border-gray-100 pt-2 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push("/dashboard/profile");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <UserCircleIcon className="h-5 w-5" aria-hidden="true" />
                    Profile, photo, and preferences
                  </button>

                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" aria-hidden="true" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
