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
  // Built-in keys or any key published from the Template Studio; unknown keys fall back to Classic.
  themeKey: z
    .string()
    .regex(/^[a-z0-9_]+$/)
    .default("classic_season"),
  defaultedFields: z.array(z.string()).optional(),
  brandId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { brandId, ...brief } = briefSchema.parse(body);
    const svc = getCampaignDraftService();
    const draft = await svc.createDraft({
      operatorId: DEMO.operatorId,
      orgId: DEMO.orgId,
      createdBy: DEMO.createdBy,
      brief,
      brandId,
    });
    return NextResponse.json(draft, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
