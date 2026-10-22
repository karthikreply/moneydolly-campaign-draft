import { notFound } from "next/navigation";
import { PublicCampaignPage } from "@/components/public/PublicCampaignPage";
import { findOperator } from "@/domain/operators";
import { getCampaignDraftService } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function ParticipantPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; participant: string }>;
  searchParams: Promise<{ op?: string }>;
}) {
  const { slug, participant: participantSlug } = await params;
  const { op } = await searchParams;
  const svc = getCampaignDraftService();
  const campaign = svc.getCampaignBySlug(slug);
  if (!campaign) notFound();
  const participant = svc.getParticipantBySlug(campaign.id, participantSlug);
  if (!participant) notFound();

  return (
    <PublicCampaignPage
      campaign={campaign}
      participant={participant}
      roster={svc.listParticipants(campaign.id)}
      catalog={svc.getCatalog()}
      operator={findOperator(op ?? "apex")}
      progress={svc.getProgress(campaign.id, participant.id)}
    />
  );
}
