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
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
