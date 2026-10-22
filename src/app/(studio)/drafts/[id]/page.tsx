import { notFound } from "next/navigation";
import { DraftReviewSplit } from "@/components/DraftReviewSplit";
import { DEMO, getCampaignDraftService } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function DraftReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const svc = getCampaignDraftService();
  const draft = svc.getDraft(DEMO.operatorId, id);
  if (!draft) notFound();
  const campaign = draft.campaignId
    ? svc.getCampaign(DEMO.operatorId, draft.campaignId)
    : null;
  const roster = campaign ? svc.listParticipants(campaign.id) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{campaign ? "Live campaign" : "Draft review"}</span>
          <h1>{draft.headline || "Untitled campaign"}</h1>
          <p>Edit on the left. The supporter page and the student app update on the right.</p>
        </div>
      </div>
      <DraftReviewSplit
        initialDraft={draft}
        catalog={svc.getCatalog()}
        initialCampaign={campaign}
        initialRoster={roster}
      />
    </>
  );
}
