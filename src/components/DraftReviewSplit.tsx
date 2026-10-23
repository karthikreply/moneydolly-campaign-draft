"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/domain/campaign-draft/fee-preview";
import { slugify } from "@/domain/campaign-draft/slug";
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
import { apiPublishDraft, apiUpdateDraft } from "@/lib/campaign-client";
import { useOperator } from "./OperatorProvider";

function previewSlug(orgName: string, sport: string): string {
  const org = slugify(orgName);
  const sportKey = slugify(sport);
  return sportKey && org.includes(sportKey) ? org : slugify(`${orgName} ${sport}`);
}

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
  const [view, setView] = useState<"supporter" | "student">("supporter");
  const [copied, setCopied] = useState<string | null>(null);

  async function copyLink(path: string) {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(path);
      window.setTimeout(() => setCopied((c) => (c === path ? null : c)), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

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
    const data = await apiUpdateDraft(draft.id, {
      goalCents: patch.goalCents,
      headline: patch.headline,
      supportingLine: patch.supportingLine,
      whyDraft: patch.whyDraft,
      skuIds: patch.skuIds,
      surfaceOrder: patch.surfaceOrder,
    });
    setDraft(data);
  }

  async function onPublish() {
    setBusy(true);
    setError(null);
    try {
      const data = await apiPublishDraft(draft.id);
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

  const teamPath = published ? `/c/${published.slug}?op=${operator.id}` : "";
  const editable = draft.status === "draft";

  return (
    <div>
      <div className="status-strip">
        {publishedId ? <span className="badge badge-active">Live</span> : <span className="badge">Draft</span>}
        <span className="badge">{theme.name}</span>
        <NoteFilterBadge filter={draft.noteFilter} />
        {defaulted.map((field) => (
          <span key={field} className="badge badge-default">
            {defaultLabels[field] ?? `${field} defaulted`}
          </span>
        ))}
      </div>

      {publishedId && published ? (
        <section className="share-links" aria-labelledby="share-heading">
          <div className="share-head">
            <div>
              <h2 id="share-heading">Your campaign is live</h2>
              <p className="muted">
                Send the team link to everyone. Each player link credits that player&apos;s goal.
              </p>
            </div>
            <div className="share-head-actions">
              <button className="btn btn-accent" type="button" onClick={() => router.push("/student")}>
                See it as a Student
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => router.push("/agent")}>
                Start another
              </button>
            </div>
          </div>

          <div className="share-team">
            <span className="share-name">Team page</span>
            <a href={teamPath} target="_blank" rel="noreferrer">
              <code>/c/{published.slug}</code>
            </a>
            <button className="btn btn-accent" type="button" onClick={() => void copyLink(teamPath)}>
              {copied === teamPath ? "Copied" : "Copy link"}
            </button>
          </div>

          <ul aria-label="Player links">
            {roster.map((p) => {
              const path = `/c/${published.slug}/${p.slug}?op=${operator.id}`;
              return (
                <li key={p.id}>
                  <span className="share-name">{p.displayName}</span>
                  <a href={path} target="_blank" rel="noreferrer" aria-label={`Open ${p.displayName}'s page`}>
                    Open
                  </a>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => void copyLink(path)}
                    aria-label={`Copy ${p.displayName}'s link`}
                  >
                    {copied === path ? "Copied" : "Copy"}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="sr-only" aria-live="polite">
            {copied ? "Link copied" : ""}
          </p>
        </section>
      ) : null}

      <div className="split">
        <div className="panel">
          <div className="panel-head">
            <h2>{editable ? "Edit the words" : "Campaign details"}</h2>
          </div>

          <div className="field">
            <label htmlFor="headline">Headline</label>
            <textarea
              id="headline"
              rows={2}
              value={draft.headline}
              disabled={!editable}
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
              onBlur={() => void persist({ headline: draft.headline })}
            />
          </div>

          <div className="field">
            <label htmlFor="supportingLine">Supporting line</label>
            <textarea
              id="supportingLine"
              rows={2}
              value={draft.supportingLine}
              disabled={!editable}
              onChange={(e) =>
                setDraft({ ...draft, supportingLine: e.target.value })
              }
              onBlur={() => void persist({ supportingLine: draft.supportingLine })}
            />
          </div>

          <div className="field">
            <label htmlFor="whyDraft">Why we&apos;re raising</label>
            <textarea
              id="whyDraft"
              rows={2}
              value={draft.whyDraft}
              disabled={!editable}
              onChange={(e) => setDraft({ ...draft, whyDraft: e.target.value })}
              onBlur={() => void persist({ whyDraft: draft.whyDraft })}
            />
          </div>

          <div className="panel-head panel-head-sub">
            <h2>Goal and offers</h2>
          </div>

          <div className="field goal-field">
            <label htmlFor="goalDollars">Goal (USD)</label>
            <div className="input-prefix">
              <span aria-hidden="true">$</span>
              <input
                id="goalDollars"
                type="number"
                min={0}
                step={1}
                className="money"
                value={Math.round(draft.goalCents / 100)}
                disabled={!editable}
                onChange={(e) =>
                  setDraft({ ...draft, goalCents: Math.max(0, Math.round(Number(e.target.value) * 100)) })
                }
                onBlur={() => void persist({ goalCents: draft.goalCents })}
              />
            </div>
          </div>

          <ul className="offer-list" aria-label="Offers on this campaign">
            {selectedSkus.map((s) => (
              <li key={s.id}>
                <span>{s.name}</span>
                <span className="money">
                  {s.kind === "product" ? formatCents(s.retailCents) : "Any amount"}
                </span>
              </li>
            ))}
          </ul>

          <details className="rules-note" open>
            <summary>How these numbers were set</summary>
            <p>{draft.whyRules}</p>
            <p className="muted">
              Preset v{draft.presetVersion} · Copy {draft.copyStatus}
            </p>
          </details>

          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}

          {editable ? (
            <PublishBar
              canPublish={canPublish}
              busy={busy}
              onPublish={() => void onPublish()}
            />
          ) : null}
        </div>

        <div className="preview-col">
          <div className="segmented" role="group" aria-label="Preview">
            <button
              type="button"
              aria-pressed={view === "supporter"}
              onClick={() => setView("supporter")}
            >
              Supporter page
            </button>
            <button
              type="button"
              aria-pressed={view === "student"}
              onClick={() => setView("student")}
            >
              Student app
            </button>
          </div>

          {view === "supporter" ? (
            <div className="browser" aria-label="Supporter page preview">
              <div className="browser-bar">
                <span className="browser-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="browser-url">
                  {`/c/${published?.slug ?? previewSlug(draft.brief.orgDisplayName, draft.brief.sport)}`}
                </span>
              </div>
              <SupporterPagePreview
                draft={draft}
                catalog={catalog}
                donationFeeBps={feeRateToBps(operator.customFeeRate)}
              />
            </div>
          ) : (
            <div className="phone-stage">
              <ParticipantAppPreview draft={draft} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
