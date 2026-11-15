import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexusDesk AI | Customer support answers from your own data",
  description: "Connect your website, FAQs or product catalog and get an AI support agent that cites its sources and hands tricky cases to your team.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-slate-100 antialiased selection:bg-cyan selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
