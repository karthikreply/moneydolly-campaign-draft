import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CampaignDraftService } from "../src/domain/campaign-draft/campaign-draft-service";
import { openDb } from "../src/db/client";

const tmpFiles: string[] = [];

function tempDb(): string {
  const file = path.join(os.tmpdir(), `draft-test-${Date.now()}-${Math.random()}.sqlite`);
  tmpFiles.push(file);
  return file;
}

afterEach(() => {
  for (const f of tmpFiles.splice(0)) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(`${f}-wal`);
      fs.unlinkSync(`${f}-shm`);
    } catch {
      /* ignore */
    }
  }
});

describe("CampaignDraftService", () => {
  it("create → patch → publish is idempotent", async () => {
    const db = openDb(tempDb());
    const svc = new CampaignDraftService(db);

    const draft = await svc.createDraft({
      operatorId: "op1",
      orgId: "org1",
      createdBy: "dir1",
      brief: {
        sport: "volleyball",
        windowStart: "2026-03-01",
        windowEnd: "2026-04-15",
        rosterSize: 12,
        note: "under $25",
        orgDisplayName: "Lincoln VB",
      },
    });

    expect(draft.status).toBe("draft");
    expect(draft.presetVersion).toBeGreaterThanOrEqual(1);
    expect(draft.noteFilter.type).toBe("max_price");

    const updated = svc.updateDraft("op1", draft.id, {
      headline: "Go Lincoln Volleyball",
      goalCents: draft.goalCents + 1000,
    });
    expect(updated.headline).toBe("Go Lincoln Volleyball");

    const first = svc.publishDraft("op1", draft.id);
    expect(first.draft.status).toBe("published");
    expect(first.campaign.offerProductIds.length).toBeGreaterThan(0);

    const second = svc.publishDraft("op1", draft.id);
    expect(second.campaign.id).toBe(first.campaign.id);

    expect(svc.getDraft("op2", draft.id)).toBeNull();
    db.close();
  });

  it("blocks publish with empty headline", async () => {
    const db = openDb(tempDb());
    const svc = new CampaignDraftService(db);
    const draft = await svc.createDraft({
      operatorId: "op1",
      orgId: "org1",
      createdBy: "dir1",
      brief: {
        sport: "soccer",
        windowStart: "2026-03-01",
        windowEnd: "2026-04-15",
        rosterSize: 10,
        note: "",
        orgDisplayName: "Tigers",
      },
    });
    svc.updateDraft("op1", draft.id, { headline: "   " });
    expect(() => svc.publishDraft("op1", draft.id)).toThrow(/Headline required/i);
    db.close();
  });
});
