import type { Metadata } from "next";
import Link from "next/link";
import { OperatorProvider } from "@/components/OperatorProvider";
import { OperatorSwitcher } from "@/components/OperatorSwitcher";
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
        <OperatorProvider>
          <div className="app-shell">
            <header className="topbar">
              <div className="brand-lockup">
                <span className="operator-mark" role="img" aria-label="Operator logo" />
                <div>
                  <p className="brand">
                    Field<span>Fund</span> Draft
                  </p>
                  <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                    Director console · rules for numbers · AI for copy
                  </p>
                </div>
              </div>
              <OperatorSwitcher />
              <nav style={{ display: "flex", gap: "1rem" }}>
                <Link href="/">Home</Link>
                <Link href="/drafts/new">New campaign</Link>
              </nav>
            </header>
            {children}
          </div>
        </OperatorProvider>
      </body>
    </html>
  );
}
