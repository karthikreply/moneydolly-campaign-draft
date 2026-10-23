"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { DraftReviewSplit } from "@/components/DraftReviewSplit";
import type { CampaignDraft, CatalogSku, Participant, PublishedCampaign } from "@/domain/campaign-draft/types";
import { apiGetDraftBundle } from "@/lib/campaign-client";
import { loadRegistrySafely } from "@/lib/registry-sync";

export function DraftReviewFromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DraftReviewLoader id={id} />;
}

export function DraftReviewLoader({ id }: { id: string }) {
  const [bundle, setBundle] = useState<{
    draft: CampaignDraft;
    catalog: CatalogSku[];
    campaign: PublishedCampaign | null;
    roster: Participant[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadRegistrySafely()
      .then(() => apiGetDraftBundle(id))
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setError("This draft isn't in this browser. Start again from the brief.");
          return;
        }
        setBundle(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <p className="error" role="alert">
        {error} <Link href="/drafts/new">Open the brief</Link>
      </p>
    );
  }

  if (!bundle) {
    return (
      <div className="draft-skeleton" aria-busy="true" aria-live="polite">
        <p className="sr-only">Loading draft</p>
        <div className="sk-line sk-eyebrow" />
        <div className="sk-line sk-title" />
        <div className="sk-split">
          <div className="sk-panel" />
          <div className="sk-panel" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{bundle.campaign ? "Live campaign" : "Draft review"}</span>
          <h1>{bundle.draft.headline || "Untitled campaign"}</h1>
          <p>Edit on the left. The supporter page and the student app update on the right.</p>
        </div>
      </div>
      <DraftReviewSplit
        initialDraft={bundle.draft}
        catalog={bundle.catalog}
        initialCampaign={bundle.campaign}
        initialRoster={bundle.roster}
      />
    </>
  );
}
