import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SKYLINE",
  description: "Economic tournament lobby and simulation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

