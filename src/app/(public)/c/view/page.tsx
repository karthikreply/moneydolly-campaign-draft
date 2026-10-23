"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PublicCampaignView } from "@/components/public/PublicCampaignLoader";

function PayFromQuery() {
  const params = useSearchParams();
  const slug = params.get("slug");
  const participant = params.get("participant") ?? undefined;
  if (!slug) {
    return (
      <p className="public-error" role="alert">
        This pay link is missing a campaign.
      </p>
    );
  }
  return <PublicCampaignView slug={slug} participantSlug={participant} />;
}

/** Static page so a newly published campaign can open on GitHub Pages. */
export default function PublicCampaignQueryPage() {
  return (
    <Suspense fallback={<p className="public-muted">Loading campaign…</p>}>
      <PayFromQuery />
    </Suspense>
  );
}
