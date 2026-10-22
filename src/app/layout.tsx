import type { Metadata } from "next";
import Link from "next/link";
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
        <div className="app-shell">
          <header className="topbar">
            <div>
              <p className="brand">
                Field<span>Fund</span> Draft
              </p>
              <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                Director console · rules for numbers · AI for copy
              </p>
            </div>
            <nav style={{ display: "flex", gap: "1rem" }}>
              <Link href="/">Home</Link>
              <Link href="/drafts/new">New campaign</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
