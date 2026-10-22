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
        <Link href="/" className="brand-lockup" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="operator-mark" role="img" aria-label="Operator logo" />
          <span>
            <p className="brand">
              Field<span>Fund</span>
            </p>
            <p className="brand-sub">Director console</p>
          </span>
        </Link>
        <nav className="studio-nav" aria-label="Primary">
          <Link href="/agent">Agent</Link>
          <Link href="/drafts/new">Brief</Link>
        </nav>
        <OperatorSwitcher />
      </header>
      <main id="studio-main" className="studio-main">
        {children}
      </main>
    </div>
  );
}
