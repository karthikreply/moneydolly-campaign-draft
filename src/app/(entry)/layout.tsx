import { OperatorSwitcher } from "@/components/OperatorSwitcher";

/** First screen of the demo: choose a persona. No studio chrome until a role is picked. */
export default function EntryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="entry-shell">
      <header className="entry-top">
        <div className="brand-lockup">
          <span className="operator-mark" role="img" aria-label="Operator logo" />
          <span>
            <p className="brand">
              Field<span>Fund</span>
            </p>
            <p className="brand-sub">Live demo</p>
          </span>
        </div>
        <OperatorSwitcher />
      </header>
      <main id="entry-main">{children}</main>
    </div>
  );
}
