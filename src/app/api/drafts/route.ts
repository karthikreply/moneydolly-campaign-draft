import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO, getCampaignDraftService } from "@/lib/service";

const briefSchema = z.object({
  sport: z.string().min(1),
  windowStart: z.string().min(1),
  windowEnd: z.string().min(1),
  rosterSize: z.number().int().min(1),
  note: z.string().default(""),
  orgDisplayName: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const brief = briefSchema.parse(body);
    const svc = getCampaignDraftService();
    const draft = await svc.createDraft({
      operatorId: DEMO.operatorId,
      orgId: DEMO.orgId,
      createdBy: DEMO.createdBy,
      brief,
    });
    return NextResponse.json(draft, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
