import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELO Payroll Association — Payroll consulting",
  description:
    "Payroll compliance reviews, remediation, system reviews, and technology procurement for Australian employers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
