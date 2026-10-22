import { NextResponse } from "next/server";
import { DEMO, getCampaignDraftService } from "@/lib/service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const result = getCampaignDraftService().publishDraft(DEMO.operatorId, id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
