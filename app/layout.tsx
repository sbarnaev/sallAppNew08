import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NewYearDecor } from "@/components/NewYearDecor";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "SAL App",
  description: "SAL profiles and Q&A",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-sans",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} min-h-screen font-sans antialiased relative overflow-x-hidden`}>
        <NewYearDecor />
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}
