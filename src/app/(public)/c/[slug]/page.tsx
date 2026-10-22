import { notFound } from "next/navigation";
import { PublicCampaignPage } from "@/components/public/PublicCampaignPage";
import { findOperator } from "@/domain/operators";
import { getCampaignDraftService } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function CampaignPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ op?: string }>;
}) {
  const { slug } = await params;
  const { op } = await searchParams;
  const svc = getCampaignDraftService();
  const campaign = svc.getCampaignBySlug(slug);
  if (!campaign) notFound();

  return (
    <PublicCampaignPage
      campaign={campaign}
      participant={null}
      roster={svc.listParticipants(campaign.id)}
      catalog={svc.getCatalog()}
      operator={findOperator(op ?? "apex")}
      progress={svc.getProgress(campaign.id)}
    />
  );
}
