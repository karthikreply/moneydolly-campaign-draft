import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO, getCampaignDraftService } from "@/lib/service";

const patchSchema = z.object({
  goalCents: z.number().int().positive().optional(),
  surfaceOrder: z.enum(["shop_first", "donate_first"]).optional(),
  skuIds: z.array(z.string()).optional(),
  headline: z.string().optional(),
  supportingLine: z.string().optional(),
  whyDraft: z.string().optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const svc = getCampaignDraftService();
  const draft = svc.getDraft(DEMO.operatorId, id);
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bundle = new URL(req.url).searchParams.get("bundle") === "1";
  if (!bundle) return NextResponse.json(draft);
  const campaign = draft.campaignId ? svc.getCampaign(DEMO.operatorId, draft.campaignId) : null;
  const roster = campaign ? svc.listParticipants(campaign.id) : [];
  return NextResponse.json({ draft, catalog: svc.getCatalog(), campaign, roster });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const patch = patchSchema.parse(await req.json());
    const draft = getCampaignDraftService().updateDraft(DEMO.operatorId, id, patch);
    return NextResponse.json(draft);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
