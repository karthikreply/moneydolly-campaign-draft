"use client";

import Link from "next/link";
import { useState } from "react";

/** Demo-only way back from a supporter page. Supporters in a real rollout never see this. */
export function DemoReturnPill() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <nav className="demo-pill" aria-label="Demo navigation">
      <span className="demo-pill-tag">Demo · Supporter view</span>
      <Link href="/student">Back to Student</Link>
      <Link href="/">Switch persona</Link>
      <button type="button" onClick={() => setHidden(true)} aria-label="Hide demo navigation">
        ×
      </button>
    </nav>
  );
}
