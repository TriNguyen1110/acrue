import type { Metadata } from "next";
import { DM_Serif_Display, Inter, DM_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Acrue",
  description: "Smart market signals, alerts, and portfolio optimization.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSerifDisplay.variable} ${inter.variable} ${dmMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
