import "./globals.css";
import type { Metadata } from "next";

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
    <html lang="en">
      <body className="bg-villa text-ocean antialiased h-screen w-screen overflow-hidden font-sans">
        {children}
      </body>
    </html>
  );
}
