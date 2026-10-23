"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { listSports, listThemes } from "@/domain/admin/presets-and-catalog";
import { resolveThemePack } from "@/domain/campaign-draft/theme-packs";
import type { ExtractedSlots } from "@/domain/campaign-draft/slot-extractor";
import { OmniBar } from "@/components/OmniBar";
import { useOperator } from "@/components/OperatorProvider";
import { apiCreateDraft } from "@/lib/campaign-client";
import { hydrateRegistryFromStorage } from "@/lib/registry-storage";

const FOCUS_ID: Record<string, string> = {
  sport: "sport",
  roster: "rosterSize",
  window: "windowStart",
  orgName: "orgDisplayName",
  themePack: "theme-pack",
};

export function BriefForm() {
  const router = useRouter();
  const { operator } = useOperator();
  const [registryTick, setRegistryTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [sport, setSport] = useState("volleyball");
  const [orgDisplayName, setOrgDisplayName] = useState("Lincoln Volleyball");
  const [rosterSize, setRosterSize] = useState("18");
  const [windowStart, setWindowStart] = useState("2026-03-01");
  const [windowEnd, setWindowEnd] = useState("2026-04-15");
  const [note, setNote] = useState("Keep items under $25");
  const [themeKey, setThemeKey] = useState("classic_season");

  useEffect(() => {
    hydrateRegistryFromStorage();
    setRegistryTick((n) => n + 1);
  }, []);

  const sports = useMemo(() => {
    void registryTick;
    return listSports(operator.id).map((s) => ({
      value: s.sportKey,
      label: s.displayName,
    }));
  }, [operator.id, registryTick]);

  const themes = useMemo(() => {
    void registryTick;
    return listThemes(operator.id);
  }, [operator.id, registryTick]);

  const selectedTheme = useMemo(
    () => resolveThemePack(themeKey, operator.id),
    [themeKey, operator.id],
  );

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(focusId.split(":")[0])?.focus();
  }, [focusId]);

  function applyExtracted(slots: ExtractedSlots) {
    if (slots.sport && sports.some((s) => s.value === slots.sport)) {
      setSport(slots.sport);
    }
    if (slots.orgDisplayName) setOrgDisplayName(slots.orgDisplayName);
    if (slots.rosterSize) setRosterSize(String(slots.rosterSize));
    if (slots.windowStart) setWindowStart(slots.windowStart);
    if (slots.windowEnd) setWindowEnd(slots.windowEnd);
    if (slots.note) setNote(slots.note);
    if (slots.themeKey && themes.some((t) => t.key === slots.themeKey)) {
      setThemeKey(slots.themeKey);
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
      const data = await apiCreateDraft(body);
      router.push(`/drafts/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft failed");
      setBusy(false);
    }
  }

  return (
    <form className="panel brief-form" onSubmit={onSubmit}>
      <header className="brief-head">
        <span className="eyebrow">New campaign</span>
        <h1>Campaign brief</h1>
        <p>One sentence in the bar, or the fields below. The rules set the goal and the products.</p>
      </header>

      <OmniBar
        busy={busy}
        onDrafted={(draftId) => router.push(`/drafts/${draftId}`)}
        onPartial={onPartial}
      />

      <section className="brief-section" aria-labelledby="brief-program">
        <h2 id="brief-program">Program</h2>
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
            {sports.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      </section>

      <section className="brief-section">
      <fieldset id="theme-pack" tabIndex={-1} className="theme-picker">
        <legend>Theme</legend>
        <div className="theme-grid">
          {themes.map((theme) => {
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
                <span className="theme-name">{theme.name}</span>
                <span className="theme-check" aria-hidden="true">
                  {active ? "✓" : ""}
                </span>
                <span className="theme-tags">{theme.productTags.slice(0, 2).join(" · ")}</span>
                {active ? <span className="sr-only">Selected</span> : null}
              </button>
            );
          })}
        </div>
        <p className="theme-note">
          {selectedTheme.description} Tone: {selectedTheme.copyTone}.
        </p>
      </fieldset>
      </section>

      <section className="brief-section" aria-labelledby="brief-roster">
        <h2 id="brief-roster">Roster and limits</h2>
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
      </section>

      <section className="brief-section" aria-labelledby="brief-when">
        <h2 id="brief-when">Dates</h2>
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
      </section>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="publish-bar">
        <p>Goal and products come from the rules. You approve the words next.</p>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Drafting…" : "Build draft"}
        </button>
      </div>
    </form>
  );
}
