import { NextResponse } from "next/server";
import { THEME_LIST } from "@/domain/campaign-draft/theme-packs";

export async function GET() {
  return NextResponse.json(THEME_LIST);
}
