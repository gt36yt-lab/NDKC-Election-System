import type { Metadata } from "next";
import DataRefresh from "./data-refresh";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSLG E-Voting | NDKC",
  description: "The student election portal for NDKC.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><DataRefresh />{children}</body>
    </html>
  );
}