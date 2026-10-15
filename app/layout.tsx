import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSLG E-Voting | NDKC",
  description: "The student election portal for NDKC.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}