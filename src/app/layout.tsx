import type { Metadata } from "next";
import { OperatorProvider } from "@/components/OperatorProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campaign Draft Agent",
  description: "Director-facing campaign draft assistant for white-label fundraising",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&family=Schibsted+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <OperatorProvider>{children}</OperatorProvider>
      </body>
    </html>
  );
}
