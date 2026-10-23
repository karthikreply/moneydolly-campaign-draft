import { NextResponse } from "next/server";
import { z } from "zod";
import { generateTemplatePack } from "@/domain/admin/generate-template-pack";
import {
  deserializeRegistry,
  listPublishedPacks,
  publishPack,
  serializeRegistry,
} from "@/domain/admin/presets-and-catalog";
import type { PublishedTemplatePack } from "@/domain/admin/template-pack-types";
import { getDb } from "@/db/client";
import { DEMO } from "@/lib/demo-tenant";

function loadRegistryFromDb(): void {
  const db = getDb();
  const rows = db
    .prepare(`SELECT payload_json FROM template_registry ORDER BY updated_at ASC, rowid ASC`)
    .all() as { payload_json: string }[];
  const published = rows.map((row) => JSON.parse(row.payload_json) as PublishedTemplatePack);
  deserializeRegistry({ published });
}

/** The in-memory registry is the source of truth after a publish: replaced packs drop out, ids stay current. */
function saveRegistryToDb(): void {
  const db = getDb();
  const insert = db.prepare(`INSERT INTO template_registry (id, payload_json, updated_at) VALUES (?, ?, ?)`);
  db.transaction((packs: PublishedTemplatePack[]) => {
    db.prepare(`DELETE FROM template_registry`).run();
    for (const p of packs) insert.run(p.id, JSON.stringify(p), p.publishedAt);
  })(listPublishedPacks());
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    prompt: z.string().min(1),
    scope: z.enum(["platform", "operator"]).optional(),
    operatorId: z.string().optional(),
  }),
  z.object({
    action: z.literal("publish"),
    scope: z.enum(["platform", "operator"]),
    operatorId: z.string().nullable().optional(),
    pack: z.object({ id: z.string() }).passthrough(),
  }),
]);

export async function GET() {
  loadRegistryFromDb();
  return NextResponse.json(serializeRegistry());
}

export async function POST(req: Request) {
  try {
    loadRegistryFromDb();
    const body = postSchema.parse(await req.json());
    if (body.action === "generate") {
      const operatorId = body.operatorId ?? DEMO.operatorId;
      const result = generateTemplatePack(body.prompt, {
        operatorId,
        scope: body.scope ?? "platform",
      });
      return NextResponse.json(result);
    }

    const operatorId =
      body.scope === "operator" ? (body.operatorId ?? DEMO.operatorId) : null;
    const published = publishPack(body.pack as never, body.scope, operatorId);
    saveRegistryToDb();
    return NextResponse.json(published);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
