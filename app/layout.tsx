import type { Metadata } from "next";
import { Inter, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Body / data text
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Headlines (sharp contemporary grotesque)
const display = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
// Labels, IPs, code-like data
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "NetTopo AI -- AI Network Topology & Planner",
  description:
    "Describe, draw, or upload a network and get a professional topology diagram plus a full IP/VLAN/routing plan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${inter.variable} ${display.variable} ${mono.variable} font-sans antialiased`}
        >
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            {children}
            <Toaster richColors position="top-center" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}