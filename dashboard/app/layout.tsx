import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Aegis — Runtime Threat Monitor",
  description: "Real-time eBPF npm supply chain attack runtime visualization and kill switch",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${inter.variable} bg-background text-foreground antialiased min-h-screen font-sans`}>
        {children}
      </body>
    </html>
  );
}
