import { NextResponse } from "next/server";
import { getCampaignDraftService } from "@/lib/service";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  const participantSlug = url.searchParams.get("participant")?.trim() || null;
  const svc = getCampaignDraftService();
  const campaign = svc.getCampaignBySlug(slug);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const participant = participantSlug
    ? svc.getParticipantBySlug(campaign.id, participantSlug)
    : null;
  if (participantSlug && !participant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    campaign,
    participant,
    roster: svc.listParticipants(campaign.id),
    catalog: svc.getCatalog(),
    progress: svc.getProgress(campaign.id, participant?.id ?? null),
  });
}
