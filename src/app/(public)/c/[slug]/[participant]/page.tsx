import { Suspense } from "react";
import { PublicCampaignLoader } from "@/components/public/PublicCampaignLoader";

const SEED_SLUG = "lincoln-volleyball";
const SEED_PARTICIPANTS = [
  "jordan-lee",
  "priya-nair",
  "marcus-hill",
  "sofia-alvarez",
  "ethan-brooks",
  "maya-chen",
];

export function generateStaticParams() {
  return SEED_PARTICIPANTS.map((participant) => ({ slug: SEED_SLUG, participant }));
}

export default function ParticipantPublicPage({
  params,
}: {
  params: Promise<{ slug: string; participant: string }>;
}) {
  return (
    <Suspense fallback={<p className="public-muted">Loading campaign…</p>}>
      <PublicCampaignLoader params={params} />
    </Suspense>
  );
}
