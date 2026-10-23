import { Suspense } from "react";
import { PublicCampaignLoader } from "@/components/public/PublicCampaignLoader";

const SEED_SLUG = "lincoln-volleyball";

export function generateStaticParams() {
  return [{ slug: SEED_SLUG }];
}

export default function CampaignPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<p className="public-muted">Loading campaign…</p>}>
      <PublicCampaignLoader params={params} />
    </Suspense>
  );
}
