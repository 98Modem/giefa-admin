export type ThemeMode = "light" | "dark" | "system";

export type ColorTheme = "blue" | "emerald" | "violet" | "rose" | "amber";

export type SidebarPosition = "left" | "right" | "floating";

export const themeModes: { label: string; value: ThemeMode }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

export const colorThemes: {
  label: string;
  value: ColorTheme;
  swatch: string;
}[] = [
  { label: "Blue", value: "blue", swatch: "#465fff" },
  { label: "Emerald", value: "emerald", swatch: "#059669" },
  { label: "Violet", value: "violet", swatch: "#7c3aed" },
  { label: "Rose", value: "rose", swatch: "#e11d48" },
  { label: "Amber", value: "amber", swatch: "#d97706" },
];

export const sidebarPositions: {
  label: string;
  value: SidebarPosition;
  description: string;
}[] = [
  {
    label: "Left",
    value: "left",
    description: "Classic navigation anchored on the left.",
  },
  {
    label: "Right",
    value: "right",
    description: "Navigation anchored on the right for right-hand access.",
  },
  {
    label: "Floating",
    value: "floating",
    description: "Compact floating navigation over the workspace.",
  },
];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function isColorTheme(value: unknown): value is ColorTheme {
  return (
    value === "blue" ||
    value === "emerald" ||
    value === "violet" ||
    value === "rose" ||
    value === "amber"
  );
}

export function isSidebarPosition(value: unknown): value is SidebarPosition {
  return value === "left" || value === "right" || value === "floating";
}

export function applyThemePreference(
  themeMode: ThemeMode,
  colorTheme: ColorTheme
) {
  if (typeof document === "undefined") return;

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldUseDark = themeMode === "dark" || (themeMode === "system" && prefersDark);

  document.documentElement.classList.toggle("dark", shouldUseDark);
  document.documentElement.dataset.accent = colorTheme;
}
