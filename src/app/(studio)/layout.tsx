import Link from "next/link";
import { OperatorSwitcher } from "@/components/OperatorSwitcher";

/** Director console chrome. Public supporter pages live in the (public) group and never render this. */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
