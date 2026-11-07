import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import "./globals.css";

const neueMontreal = localFont({
  src: [
    {
      path: "../assets/fonts/PPNeueMontreal-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/PPNeueMontreal-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../assets/fonts/PPNeueMontreal-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-neue-montreal",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Offboard — Prove their access is gone",
    template: "%s | Offboard",
  },
  description:
    "Find forgotten access, coordinate human-approved removals, and verify the outcome with clear evidence.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${neueMontreal.variable} scheme-dark`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased selection:bg-brand/30 selection:text-white">
        <a
          href="#main-content"
          className="sr-only z-50 bg-brand px-4 py-3 text-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:outline-2 focus:outline-offset-4 focus:outline-brand"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
