import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO, getCampaignDraftService } from "@/lib/service";

const bodySchema = z.object({
  utterance: z.string().trim().min(1),
});

export async function POST(req: Request) {
  try {
    const { utterance } = bodySchema.parse(await req.json());
    const result = await getCampaignDraftService().intakeUtterance({
      operatorId: DEMO.operatorId,
      orgId: DEMO.orgId,
      createdBy: DEMO.createdBy,
      utterance,
    });
    return NextResponse.json(result, { status: result.canDraft ? 201 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
