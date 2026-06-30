import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/app/components/theme/ThemeProvider";

export const metadata: Metadata = {
  title: "GIEFA",
  description: "Graduate Investment and Emergency Fund Association",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeBootstrap = `
    (function () {
      try {
        var themeMode = localStorage.getItem("giefa-theme-mode") || "system";
        var colorTheme = localStorage.getItem("giefa-color-theme") || "blue";
        var validThemes = { light: true, dark: true, system: true };
        var validColors = { blue: true, emerald: true, violet: true, rose: true, amber: true };
        if (!validThemes[themeMode]) themeMode = "system";
        if (!validColors[colorTheme]) colorTheme = "blue";
        var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        var useDark = themeMode === "dark" || (themeMode === "system" && prefersDark);
        document.documentElement.classList.toggle("dark", useDark);
        document.documentElement.dataset.accent = colorTheme;
      } catch (error) {
        document.documentElement.dataset.accent = "blue";
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
