"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { DraftReviewSplit } from "@/components/DraftReviewSplit";
import type { CampaignDraft, CatalogSku, Participant, PublishedCampaign } from "@/domain/campaign-draft/types";
import { apiGetDraftBundle } from "@/lib/campaign-client";

export function DraftReviewLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [bundle, setBundle] = useState<{
    draft: CampaignDraft;
    catalog: CatalogSku[];
    campaign: PublishedCampaign | null;
    roster: Participant[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiGetDraftBundle(id)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          router.replace("/");
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
  }, [id, router]);

  if (error) {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  }

  if (!bundle) {
    return <p className="muted">Loading draft…</p>;
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
