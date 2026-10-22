"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const SPORTS = [
  { value: "volleyball", label: "Volleyball" },
  { value: "basketball", label: "Basketball" },
  { value: "soccer", label: "Soccer" },
  { value: "general", label: "General / other" },
];

export function BriefForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      sport: String(fd.get("sport")),
      orgDisplayName: String(fd.get("orgDisplayName")),
      windowStart: String(fd.get("windowStart")),
      windowEnd: String(fd.get("windowEnd")),
      rosterSize: Number(fd.get("rosterSize")),
      note: String(fd.get("note") ?? ""),
    };

    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Draft failed");
      router.push(`/drafts/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft failed");
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2 style={{ marginTop: 0, fontFamily: "var(--font-display)" }}>
        Campaign brief
      </h2>
      <p className="muted">
        Rules set the goal and offers. AI drafts copy only. You publish.
      </p>

      <div className="field">
        <label htmlFor="orgDisplayName">Organization display name</label>
        <input
          id="orgDisplayName"
          name="orgDisplayName"
          required
          defaultValue="Lincoln Volleyball"
        />
      </div>

      <div className="field">
        <label htmlFor="sport">Sport</label>
        <select id="sport" name="sport" required defaultValue="volleyball">
          {SPORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="rosterSize">Roster size</label>
        <input
          id="rosterSize"
          name="rosterSize"
          type="number"
          min={1}
          required
          defaultValue={18}
        />
      </div>

      <div className="field">
        <label htmlFor="windowStart">Window start</label>
        <input
          id="windowStart"
          name="windowStart"
          type="date"
          required
          defaultValue="2026-03-01"
        />
      </div>

      <div className="field">
        <label htmlFor="windowEnd">Window end</label>
        <input
          id="windowEnd"
          name="windowEnd"
          type="date"
          required
          defaultValue="2026-04-15"
        />
      </div>

      <div className="field">
        <label htmlFor="note">Director note (keyword filters only)</label>
        <textarea
          id="note"
          name="note"
          rows={3}
          placeholder='e.g. "under $25" or "no apparel"'
          defaultValue="Keep items under $25"
        />
      </div>

      {error ? <p className="error">{error}</p> : null}

      <button className="btn btn-accent" type="submit" disabled={busy}>
        {busy ? "Drafting…" : "Draft campaign"}
      </button>
    </form>
  );
}
