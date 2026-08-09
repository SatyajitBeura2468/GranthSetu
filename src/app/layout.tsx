import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-editorial",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://granthsetu.vercel.app"),
  title: { default: "GranthSetu", template: "%s · GranthSetu" },
  description: "Enter your institution's Library Room, discover books, and run library operations with clarity.",
  applicationName: "GranthSetu",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1411" },
  ],
};

const themeBoot = `(() => { try { const value = localStorage.getItem('granthsetu-theme') || 'system'; const dark = value === 'dark' || (value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; } catch {} })();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${instrumentSans.variable} ${newsreader.variable}`}>
      <head><Script id="theme-boot" strategy="beforeInteractive">{themeBoot}</Script></head>
      <body>{children}</body>
    </html>
  );
}
