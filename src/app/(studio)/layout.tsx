import Link from "next/link";
import { OperatorSwitcher } from "@/components/OperatorSwitcher";

/** Director console chrome. Public supporter pages live in the (public) group and never render this. */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#studio-main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="operator-mark" role="img" aria-label="Operator logo" />
          <div>
            <p className="brand">
              Field<span>Fund</span> Draft
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Director console · rules for numbers · AI for copy
            </p>
          </div>
        </div>
        <OperatorSwitcher />
        <nav style={{ display: "flex", gap: "1rem" }}>
          <Link href="/">Home</Link>
          <Link href="/agent">Talk to the agent</Link>
          <Link href="/drafts/new">Form</Link>
        </nav>
      </header>
      <div id="studio-main">{children}</div>
    </div>
  );
}
