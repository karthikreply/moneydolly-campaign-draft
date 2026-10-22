import Link from "next/link";

export default function HomePage() {
  return (
    <main className="panel">
      <h1 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>
        Campaign Draft Agent
      </h1>
      <p>
        Cut setup time for fundraising directors. Enter a short brief, review a
        fee-transparent supporter preview, then publish.
      </p>
      <ul>
        <li>Rules engine sets goal, SKUs, and surface order</li>
        <li>Keyword-only note filters (honest when unmatched)</li>
        <li>LLM drafts headline/copy with fallback templates</li>
        <li>Layout B: edit left / supporter preview right</li>
      </ul>
      <p style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link className="btn btn-accent" href="/agent">
          Talk to the campaign agent
        </Link>
        <Link className="btn btn-secondary" href="/drafts/new">
          Use the form instead
        </Link>
      </p>
    </main>
  );
}
