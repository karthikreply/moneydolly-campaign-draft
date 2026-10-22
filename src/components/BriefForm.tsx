"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { THEME_LIST, type ThemeKey } from "@/domain/campaign-draft/theme-packs";
import type { ExtractedSlots } from "@/domain/campaign-draft/slot-extractor";
import { OmniBar } from "@/components/OmniBar";

const SPORTS = [
  { value: "volleyball", label: "Volleyball" },
  { value: "basketball", label: "Basketball" },
  { value: "soccer", label: "Soccer" },
  { value: "general", label: "General / other" },
];

const FOCUS_ID: Record<string, string> = {
  sport: "sport",
  roster: "rosterSize",
  window: "windowStart",
  orgName: "orgDisplayName",
  themePack: "theme-pack",
};

export function BriefForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [sport, setSport] = useState("volleyball");
  const [orgDisplayName, setOrgDisplayName] = useState("Lincoln Volleyball");
  const [rosterSize, setRosterSize] = useState("18");
  const [windowStart, setWindowStart] = useState("2026-03-01");
  const [windowEnd, setWindowEnd] = useState("2026-04-15");
  const [note, setNote] = useState("Keep items under $25");
  const [themeKey, setThemeKey] = useState<ThemeKey>("classic_season");

  const selectedTheme = useMemo(
    () => THEME_LIST.find((t) => t.key === themeKey) ?? THEME_LIST[0],
    [themeKey],
  );

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(focusId.split(":")[0])?.focus();
  }, [focusId]);

  function applyExtracted(slots: ExtractedSlots) {
    if (slots.sport && SPORTS.some((s) => s.value === slots.sport)) {
      setSport(slots.sport);
    }
    if (slots.orgDisplayName) setOrgDisplayName(slots.orgDisplayName);
    if (slots.rosterSize) setRosterSize(String(slots.rosterSize));
    if (slots.windowStart) setWindowStart(slots.windowStart);
    if (slots.windowEnd) setWindowEnd(slots.windowEnd);
    if (slots.note) setNote(slots.note);
    if (slots.themeKey && THEME_LIST.some((t) => t.key === slots.themeKey)) {
      setThemeKey(slots.themeKey as ThemeKey);
    }
  }

  function onPartial(slots: ExtractedSlots, missing: string[]) {
    applyExtracted(slots);
    const first = missing.find((slot) => FOCUS_ID[slot]);
    setFocusId(first ? `${FOCUS_ID[first]}:${missing.join(",")}` : null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const body = {
      sport,
      orgDisplayName,
      windowStart,
      windowEnd,
      rosterSize: Number(rosterSize),
      note,
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
      <OmniBar
        busy={busy}
        onDrafted={(draftId) => router.push(`/drafts/${draftId}`)}
        onPartial={onPartial}
      />

      <div className="field-row">
        <div className="field">
          <label htmlFor="orgDisplayName">Organization</label>
          <input
            id="orgDisplayName"
            name="orgDisplayName"
            required
            value={orgDisplayName}
            onChange={(e) => setOrgDisplayName(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="sport">Sport</label>
          <select
            id="sport"
            name="sport"
            required
            value={sport}
            onChange={(e) => setSport(e.target.value)}
          >
            {SPORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset id="theme-pack" tabIndex={-1} className="theme-picker">
        <legend>Theme</legend>
        <div className="theme-grid">
          {THEME_LIST.map((theme) => {
            const active = theme.key === themeKey;
            return (
              <button
                key={theme.key}
                type="button"
                className="theme-card"
                aria-pressed={active}
                onClick={() => setThemeKey(theme.key)}
                style={{ background: theme.colors.background, color: theme.colors.ink }}
              >
                <span className="theme-swatch" aria-hidden="true">
                  <i style={{ background: theme.colors.accent }} />
                  <i style={{ background: theme.colors.backgroundAlt }} />
                  <i style={{ background: theme.colors.ink }} />
                </span>
                <span className="theme-name" style={{ fontFamily: theme.fonts.display }}>
                  {theme.name}
                </span>
                <span className="theme-tags">{theme.productTags.slice(0, 2).join(" · ")}</span>
                {active ? (
                  <span className="theme-check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
                {active ? <span className="sr-only">Selected</span> : null}
              </button>
            );
          })}
        </div>
        <p className="theme-note">
          {selectedTheme.description} Tone: {selectedTheme.copyTone}.
        </p>
      </fieldset>

      <div className="field-row">
        <div className="field">
          <label htmlFor="rosterSize">Roster size</label>
          <input
            id="rosterSize"
            name="rosterSize"
            type="number"
            min={1}
            required
            value={rosterSize}
            onChange={(e) => setRosterSize(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="note">Director note</label>
          <input
            id="note"
            name="note"
            placeholder='"under $25" or "no apparel"'
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <span className="hint">Keyword filters only. We tell you when nothing matched.</span>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="windowStart">Starts</label>
          <input
            id="windowStart"
            name="windowStart"
            type="date"
            required
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="windowEnd">Ends</label>
          <input
            id="windowEnd"
            name="windowEnd"
            type="date"
            required
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="publish-bar">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Drafting…" : "Build draft"}
        </button>
      </div>
    </form>
  );
}
