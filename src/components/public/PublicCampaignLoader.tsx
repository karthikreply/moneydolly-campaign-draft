"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { PublicCampaignPage } from "@/components/public/PublicCampaignPage";
import type {
  CampaignProgress,
  CatalogSku,
  Participant,
  PublishedCampaign,
} from "@/domain/campaign-draft/types";
import { findOperator } from "@/domain/operators";
import { apiGetPublicCampaignBundle } from "@/lib/campaign-client";

export function PublicCampaignLoader({
  params,
  participantSlug,
}: {
  params: Promise<{ slug: string; participant?: string }>;
  participantSlug?: string;
}) {
  const { slug, participant: paramParticipant } = use(params);
  const searchParams = useSearchParams();
  const op = searchParams.get("op") ?? undefined;
  const resolvedParticipant = participantSlug ?? paramParticipant;
  const router = useRouter();
  const operator = findOperator(op ?? "apex");

  const [bundle, setBundle] = useState<{
    campaign: PublishedCampaign;
    participant: Participant | null;
    roster: Participant[];
    catalog: CatalogSku[];
    progress: CampaignProgress;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiGetPublicCampaignBundle(slug, resolvedParticipant ?? null)
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
  }, [slug, resolvedParticipant, router]);

  if (error) {
    return (
      <p className="public-error" role="alert">
        {error}
      </p>
    );
  }

  if (!bundle) {
    return <p className="public-muted">Loading campaign…</p>;
  }

  return (
    <PublicCampaignPage
      campaign={bundle.campaign}
      participant={bundle.participant}
      roster={bundle.roster}
      catalog={bundle.catalog}
      operator={operator}
      progress={bundle.progress}
    />
  );
}
