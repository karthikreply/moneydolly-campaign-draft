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
      <body>
        <OperatorProvider>{children}</OperatorProvider>
      </body>
    </html>
  );
}
