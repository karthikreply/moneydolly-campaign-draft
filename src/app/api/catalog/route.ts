import { NextResponse } from "next/server";
import { getCampaignDraftService } from "@/lib/service";

export async function GET() {
  return NextResponse.json(getCampaignDraftService().getCatalog());
}
