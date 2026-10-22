import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO, getCampaignDraftService } from "@/lib/service";

const upsertSchema = z.object({
  sportKey: z.string().min(1),
  displayName: z.string().min(1),
  dollarsPerPlayerCents: z.number().int().positive(),
  minGoalCents: z.number().int().nullable().optional(),
  maxGoalCents: z.number().int().nullable().optional(),
  defaultProductTags: z.array(z.string()),
  defaultSurfaceOrder: z.enum(["shop_first", "donate_first"]),
});

export async function GET() {
  const presets = getCampaignDraftService().listPresets(DEMO.operatorId);
  return NextResponse.json(presets);
}

export async function PUT(req: Request) {
  try {
    const body = upsertSchema.parse(await req.json());
    const preset = getCampaignDraftService().upsertPreset({
      operatorId: DEMO.operatorId,
      ...body,
      updatedBy: DEMO.createdBy,
    });
    return NextResponse.json(preset);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
