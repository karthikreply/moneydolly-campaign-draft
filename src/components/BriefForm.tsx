"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { THEME_LIST, type ThemeKey } from "@/domain/campaign-draft/theme-packs";

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
  const [themeKey, setThemeKey] = useState<ThemeKey>("classic_season");

  const selectedTheme = useMemo(
    () => THEME_LIST.find((t) => t.key === themeKey)!,
    [themeKey],
  );

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
      themeKey,
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
        Pick a theme pack (look + SKUs + copy tone). Rules set numbers; AI drafts
        copy. You publish.
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

      <fieldset style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
        <legend style={{ fontWeight: 600, fontSize: "0.85rem" }}>
          Campaign theme pack
        </legend>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "0.65rem",
          }}
        >
          {THEME_LIST.map((theme) => {
            const active = theme.key === themeKey;
            return (
              <button
                key={theme.key}
                type="button"
                onClick={() => setThemeKey(theme.key)}
                style={{
                  textAlign: "left",
                  border: active
                    ? `2px solid ${theme.colors.accent}`
                    : "1px solid var(--line)",
                  borderRadius: 6,
                  padding: "0.65rem",
                  background: theme.colors.background,
                  color: theme.colors.ink,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: theme.colors.accent,
                    marginBottom: 8,
                  }}
                />
                <div style={{ fontFamily: theme.fonts.display, fontSize: "0.95rem" }}>
                  {theme.name}
                </div>
                <div style={{ fontSize: "0.75rem", opacity: 0.8, marginTop: 4 }}>
                  {theme.productTags.slice(0, 2).join(" · ")}
                </div>
              </button>
            );
          })}
        </div>
        <p className="muted" style={{ marginBottom: 0, marginTop: "0.75rem", fontSize: "0.85rem" }}>
          {selectedTheme.description} · tone: {selectedTheme.copyTone}
        </p>
      </fieldset>

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
