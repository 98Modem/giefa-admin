"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
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

type HeaderMember = {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  avatar_url: string | null;
  avatar_position_x: number | null;
  avatar_position_y: number | null;
  theme_mode: ThemeMode | null;
  color_theme: ColorTheme | null;
};

export function Header() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [member, setMember] = useState<HeaderMember | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [colorTheme, setColorTheme] = useState<ColorTheme>("blue");
  const closeTimerRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const loadMember = async () => {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser();

      if (!user) return;

      const { data } = await supabaseBrowser
        .from("members")
        .select("first_name, last_name, role, avatar_url, avatar_position_x, avatar_position_y, theme_mode, color_theme")
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
    return () => cancelClose();
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

  const displayName =
    [member?.first_name, member?.last_name].filter(Boolean).join(" ") ||
    "GIEFA user";
  const role = member?.role?.replace("_", " ") ?? "member";
  const avatarPosition = `${member?.avatar_position_x ?? 50}% ${
    member?.avatar_position_y ?? 50
  }%`;

  return (
    <header className="theme-header sticky top-0 z-40 flex w-full border-b px-4 py-3">
      <div className="flex flex-1 items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
          GIEFA Dashboard
        </h1>

        <div className="flex items-center gap-4">
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
              className="flex h-11 items-center gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 pr-3 text-left shadow-sm transition hover:bg-brand-50 dark:hover:bg-white/10"
              aria-expanded={open}
              aria-label="Open system menu"
            >
              <div
                className="h-8 w-8 rounded-full border border-gray-200 bg-cover bg-center bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
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
                className={`h-4 w-4 text-gray-400 transition ${
                  open ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-strong)] p-3 shadow-xl ring-1 ring-black/5 transition dark:ring-white/10">
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
