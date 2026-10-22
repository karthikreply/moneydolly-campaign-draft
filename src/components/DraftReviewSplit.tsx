"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveThemePack } from "@/domain/campaign-draft/theme-packs";
import type {
  CampaignDraft,
  CatalogSku,
  Participant,
  PublishedCampaign,
} from "@/domain/campaign-draft/types";
import { feeRateToBps } from "@/domain/operators";
import { NoteFilterBadge } from "./NoteFilterBadge";
import { ParticipantAppPreview } from "./ParticipantAppPreview";
import { PublishBar } from "./PublishBar";
import { SupporterPagePreview } from "./SupporterPagePreview";
import { useOperator } from "./OperatorProvider";

export function DraftReviewSplit({
  initialDraft,
  catalog,
  initialCampaign,
  initialRoster,
}: {
  initialDraft: CampaignDraft;
  catalog: CatalogSku[];
  initialCampaign?: PublishedCampaign | null;
  initialRoster?: Participant[];
}) {
  const router = useRouter();
  const { operator } = useOperator();
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(
    initialDraft.campaignId,
  );
  const [published, setPublished] = useState<PublishedCampaign | null>(
    initialCampaign ?? null,
  );
  const [roster, setRoster] = useState<Participant[]>(initialRoster ?? []);

  const canPublish = draft.headline.trim().length > 0 && draft.status === "draft";
  const theme = resolveThemePack(draft.brief.themeKey);
  const defaultLabels: Record<string, string> = {
    windowDays: "Window defaulted to 14 days",
    windowEnd: "End date defaulted to 14 days",
    themePack: "Theme defaulted to Classic season",
    orgName: "Organization defaulted to Program",
  };
  const defaulted = draft.brief.defaultedFields ?? [];

  const selectedSkus = useMemo(
    () => catalog.filter((s) => draft.skuIds.includes(s.id)),
    [catalog, draft.skuIds],
  );

  async function persist(patch: Partial<CampaignDraft>) {
    setError(null);
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goalCents: patch.goalCents,
        headline: patch.headline,
        supportingLine: patch.supportingLine,
        whyDraft: patch.whyDraft,
        skuIds: patch.skuIds,
        surfaceOrder: patch.surfaceOrder,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed");
    setDraft(data);
  }

  async function onPublish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      setDraft(data.draft);
      setPublishedId(data.campaign.id);
      setPublished(data.campaign);
      setRoster(data.roster ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <NoteFilterBadge filter={draft.noteFilter} />
        <span
          className="badge badge-active"
          style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}
        >
          Theme: {theme.name}
        </span>
        {defaulted.map((field) => (
          <span key={field} className="badge badge-default">
            {defaultLabels[field] ?? `${field} defaulted`}
          </span>
        ))}
        <span className="badge">Preset v{draft.presetVersion}</span>
        <span className="badge">Copy: {draft.copyStatus}</span>
        {publishedId ? (
          <span className="badge badge-active">Published · {publishedId.slice(0, 8)}</span>
        ) : null}
      </div>

      <div className="split">
        <div className="panel">
          <h2 style={{ marginTop: 0, fontFamily: "var(--font-display)" }}>
            Edit draft
          </h2>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            {draft.whyRules}
          </p>

          <div className="field">
            <label htmlFor="headline">Headline</label>
            <input
              id="headline"
              value={draft.headline}
              disabled={draft.status !== "draft"}
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
              onBlur={() => void persist({ headline: draft.headline })}
            />
          </div>

          <div className="field">
            <label htmlFor="supportingLine">Supporting line</label>
            <textarea
              id="supportingLine"
              rows={3}
              value={draft.supportingLine}
              disabled={draft.status !== "draft"}
              onChange={(e) =>
                setDraft({ ...draft, supportingLine: e.target.value })
              }
              onBlur={() => void persist({ supportingLine: draft.supportingLine })}
            />
          </div>

          <div className="field">
            <label htmlFor="goalCents">Goal (cents)</label>
            <input
              id="goalCents"
              type="number"
              value={draft.goalCents}
              disabled={draft.status !== "draft"}
              onChange={(e) =>
                setDraft({ ...draft, goalCents: Number(e.target.value) })
              }
              onBlur={() => void persist({ goalCents: draft.goalCents })}
            />
          </div>

          <div className="field">
            <label>Selected offers</label>
            <ul className="sku-list">
              {selectedSkus.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
          </div>

          <div className="field">
            <label htmlFor="whyDraft">Why this draft</label>
            <textarea
              id="whyDraft"
              rows={2}
              value={draft.whyDraft}
              disabled={draft.status !== "draft"}
              onChange={(e) => setDraft({ ...draft, whyDraft: e.target.value })}
              onBlur={() => void persist({ whyDraft: draft.whyDraft })}
            />
          </div>

          {error ? <p className="error">{error}</p> : null}

          <PublishBar
            canPublish={canPublish}
            busy={busy}
            onPublish={() => void onPublish()}
          />
        </div>

        <div className="preview-pair">
          <SupporterPagePreview
            draft={draft}
            catalog={catalog}
            donationFeeBps={feeRateToBps(operator.customFeeRate)}
          />
          <ParticipantAppPreview draft={draft} />
        </div>
      </div>

      {publishedId && published ? (
        <div className="share-links">
          <h3>Campaign is live. Share these links.</h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            Supporters open these to shop or donate. Fees shown use {operator.operatorName}
            &apos;s rate; player links credit that player&apos;s personal goal.
          </p>
          <ul>
            <li>
              Team page:{" "}
              <a href={`/c/${published.slug}?op=${operator.id}`} target="_blank" rel="noreferrer">
                <code>/c/{published.slug}</code>
              </a>
            </li>
            {roster.map((p) => (
              <li key={p.id}>
                {p.displayName}:{" "}
                <a
                  href={`/c/${published.slug}/${p.slug}?op=${operator.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>
                    /c/{published.slug}/{p.slug}
                  </code>
                </a>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            <button className="btn btn-secondary" type="button" onClick={() => router.push("/drafts/new")}>
              Start another
            </button>
          </p>
        </div>
      ) : null}
    </div>
  );
}
