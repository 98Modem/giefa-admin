"use client";

import { ReactNode, useEffect } from "react";
import { supabaseBrowser } from "@/app/lib/supabase/client";
import {
  applyThemePreference,
  ColorTheme,
  isColorTheme,
  isSidebarPosition,
  isThemeMode,
  SidebarPosition,
  ThemeMode,
} from "@/app/lib/preferences";

const preferenceEvent = "giefa-preferences-updated";

type PreferencePayload = {
  themeMode?: ThemeMode;
  colorTheme?: ColorTheme;
  sidebarPosition?: SidebarPosition;
};

function getStoredPreferences(): Required<PreferencePayload> {
  const themeMode = localStorage.getItem("giefa-theme-mode");
  const colorTheme = localStorage.getItem("giefa-color-theme");
  const sidebarPosition = localStorage.getItem("giefa-sidebar-position");

  return {
    themeMode: isThemeMode(themeMode) ? themeMode : "system",
    colorTheme: isColorTheme(colorTheme) ? colorTheme : "blue",
    sidebarPosition: isSidebarPosition(sidebarPosition)
      ? sidebarPosition
      : "left",
  };
}

export function saveLocalPreferences(
  themeMode: ThemeMode,
  colorTheme: ColorTheme,
  sidebarPosition?: SidebarPosition
) {
  localStorage.setItem("giefa-theme-mode", themeMode);
  localStorage.setItem("giefa-color-theme", colorTheme);
  if (sidebarPosition) {
    localStorage.setItem("giefa-sidebar-position", sidebarPosition);
  }
  applyThemePreference(themeMode, colorTheme);
  window.dispatchEvent(
    new CustomEvent<PreferencePayload>(preferenceEvent, {
      detail: { themeMode, colorTheme, sidebarPosition },
    })
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const stored = getStoredPreferences();
    applyThemePreference(stored.themeMode, stored.colorTheme);

    const loadMemberPreferences = async () => {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser();

      if (!user) return;

      const { data: member } = await supabaseBrowser
        .from("members")
        .select("theme_mode, color_theme, sidebar_position")
        .eq("auth_user_id", user.id)
        .maybeSingle<{
          theme_mode: ThemeMode | null;
          color_theme: ColorTheme | null;
          sidebar_position: SidebarPosition | null;
        }>();

      const themeMode = isThemeMode(member?.theme_mode)
        ? member.theme_mode
        : stored.themeMode;
      const colorTheme = isColorTheme(member?.color_theme)
        ? member.color_theme
        : stored.colorTheme;
      const sidebarPosition = isSidebarPosition(member?.sidebar_position)
        ? member.sidebar_position
        : stored.sidebarPosition;

      saveLocalPreferences(themeMode, colorTheme, sidebarPosition);
    };

    const syncSystemTheme = () => {
      const current = getStoredPreferences();
      applyThemePreference(current.themeMode, current.colorTheme);
    };

    const handlePreferenceUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PreferencePayload>).detail;
      const current = getStoredPreferences();
      applyThemePreference(
        detail.themeMode ?? current.themeMode,
        detail.colorTheme ?? current.colorTheme
      );
    };

    loadMemberPreferences();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", syncSystemTheme);
    window.addEventListener(preferenceEvent, handlePreferenceUpdate);

    return () => {
      mediaQuery.removeEventListener("change", syncSystemTheme);
      window.removeEventListener(preferenceEvent, handlePreferenceUpdate);
    };
  }, []);

  return children;
}
