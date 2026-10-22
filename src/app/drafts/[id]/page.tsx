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

  return (
    <main>
      <DraftReviewSplit initialDraft={draft} catalog={svc.getCatalog()} />
    </main>
  );
}
