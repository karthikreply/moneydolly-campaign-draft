"use client";

import { useCallback, useMemo, useState } from "react";
import type { DraftTemplatePack, PublishScope } from "@/domain/admin/template-pack-types";
import { adminGenerate, adminPublish } from "@/lib/admin-client";
import { useOperator } from "@/components/OperatorProvider";

const EXAMPLE_PROMPT =
  "Create a Spring Lacrosse template with neon green accents, min goal $2,000, max $8,000, and 5 branded merch items under $35.";

function cssVarBlock(theme: DraftTemplatePack["theme"]): string {
  const c = theme.colors;
  return [
    `--theme-accent: ${c.accent}`,
    `--theme-accent-ink: ${c.accentInk}`,
    `--theme-bg: ${c.background}`,
    `--theme-bg-alt: ${c.backgroundAlt}`,
    `--theme-ink: ${c.ink}`,
    `--theme-muted: ${c.muted}`,
    `--theme-panel: ${c.panel}`,
    `--theme-line: ${c.line}`,
  ].join(";\n");
}

export function AdminTemplateStudio() {
  const { operator } = useOperator();
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPT);
  const [scope, setScope] = useState<PublishScope>("platform");
  const [draft, setDraft] = useState<DraftTemplatePack | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [canPublish, setCanPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewStyle = useMemo(() => {
    if (!draft) return undefined;
    const c = draft.theme.colors;
    return {
      "--theme-accent": c.accent,
      "--theme-accent-ink": c.accentInk,
      "--theme-bg": c.background,
      "--theme-bg-alt": c.backgroundAlt,
      "--theme-ink": c.ink,
      "--theme-muted": c.muted,
      "--theme-panel": c.panel,
      "--theme-line": c.line,
      background: c.background,
      color: c.ink,
    } as React.CSSProperties;
  }, [draft]);

  const onGenerate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setPublishStatus(null);
    try {
      const result = await adminGenerate(prompt, operator.id, scope);
      setDraft(result.pack);
      setReply(result.reply);
      setSuggestions(result.suggestions);
      setCanPublish(result.canPublish);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }, [operator.id, prompt, scope]);

  async function onPublish() {
    if (!draft || !canPublish) return;
    setBusy(true);
    setError(null);
    try {
      await adminPublish(draft, scope, operator.id);
      setPublishStatus(
        scope === "platform"
          ? "Published to platform — Brief and Agent pickers will include this pack."
          : `Published for ${operator.operatorName}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  function onStartOver() {
    setDraft(null);
    setReply(null);
    setSuggestions([]);
    setCanPublish(false);
    setPublishStatus(null);
    setError(null);
  }

  return (
    <div className="admin-studio">
      <header className="admin-studio-head">
        <span className="eyebrow">Admin</span>
        <h1>Template Studio</h1>
        <p>Describe a sport, theme, goals, and catalog — then publish into the live registry.</p>
      </header>

      <div className="admin-studio-toolbar">
        <label className="admin-studio-prompt">
          <span className="sr-only">Natural language prompt</span>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your template pack…"
            disabled={busy}
          />
        </label>
        <div className="admin-studio-scope" role="group" aria-label="Publish scope">
          <button
            type="button"
            className={scope === "platform" ? "active" : ""}
            aria-pressed={scope === "platform"}
            onClick={() => setScope("platform")}
          >
            Platform
          </button>
          <button
            type="button"
            className={scope === "operator" ? "active" : ""}
            aria-pressed={scope === "operator"}
            onClick={() => setScope("operator")}
          >
            This operator
          </button>
        </div>
        <button type="button" className="btn" onClick={onGenerate} disabled={busy || !prompt.trim()}>
          {busy ? "Working…" : "Generate"}
        </button>
      </div>

      {reply ? (
        <p className="admin-studio-reply" role="status">
          {reply}
        </p>
      ) : null}
      {suggestions.length ? (
        <div className="admin-studio-chips">
          {suggestions.map((chip) => (
            <button key={chip} type="button" className="chip" onClick={() => setPrompt(chip)}>
              {chip}
            </button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {publishStatus ? (
        <p className="admin-studio-reply" role="status">
          {publishStatus}
        </p>
      ) : null}

      <div className="admin-studio-split">
        <section className="admin-studio-inspector panel" aria-labelledby="inspector-heading">
          <h2 id="inspector-heading">Inspector</h2>
          {!draft ? (
            <p className="admin-studio-placeholder">Generate a pack to inspect CSS variables and JSON.</p>
          ) : (
            <>
              <h3>CSS variables</h3>
              <pre className="admin-studio-code">{cssVarBlock(draft.theme)}</pre>
              <h3>Sport preset</h3>
              <pre className="admin-studio-code">{JSON.stringify(draft.sportPreset, null, 2)}</pre>
              <h3>Catalog SKUs</h3>
              <pre className="admin-studio-code">{JSON.stringify(draft.catalogSkus, null, 2)}</pre>
              <div className="admin-studio-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={onPublish}
                  disabled={busy || !canPublish}
                >
                  Publish template
                </button>
                <button type="button" className="btn btn-secondary" onClick={onStartOver} disabled={busy}>
                  Start over
                </button>
              </div>
            </>
          )}
        </section>

        <section
          className="admin-studio-preview panel"
          aria-labelledby="preview-heading"
          style={previewStyle}
        >
          <h2 id="preview-heading">Live brief preview</h2>
          {!draft ? (
            <p className="admin-studio-placeholder">Preview updates with your draft theme and offers.</p>
          ) : (
            <div className="admin-preview-brief">
              <p className="admin-preview-eyebrow">{draft.theme.name}</p>
              <h3 className="admin-preview-headline">
                {draft.theme.headlineVerb} {draft.sportPreset.displayName}
              </h3>
              <p className="admin-preview-muted">{draft.theme.description}</p>
              <ul className="admin-preview-swatches" aria-label="Theme swatches">
                {(["accent", "background", "backgroundAlt", "ink"] as const).map((key) => (
                  <li key={key}>
                    <span
                      style={{
                        background:
                          draft.theme.colors[
                            key === "background"
                              ? "background"
                              : key === "backgroundAlt"
                                ? "backgroundAlt"
                                : key
                          ],
                      }}
                    />
                    {key}
                  </li>
                ))}
              </ul>
              <dl className="admin-preview-goals">
                <div>
                  <dt>Min goal</dt>
                  <dd>
                    {draft.sportPreset.minGoalCents != null
                      ? `$${(draft.sportPreset.minGoalCents / 100).toLocaleString()}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Max goal</dt>
                  <dd>
                    {draft.sportPreset.maxGoalCents != null
                      ? `$${(draft.sportPreset.maxGoalCents / 100).toLocaleString()}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>$/player</dt>
                  <dd>${(draft.sportPreset.dollarsPerPlayerCents / 100).toFixed(0)}</dd>
                </div>
              </dl>
              <h4>Offers</h4>
              <ul className="admin-preview-offers">
                {draft.catalogSkus.map((sku) => (
                  <li key={sku.id}>
                    <span>{sku.name}</span>
                    <span>${(sku.retailCents / 100).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
