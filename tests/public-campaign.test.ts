import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CampaignDraftService } from "../src/domain/campaign-draft/campaign-draft-service";
import { openDb } from "../src/db/client";

const tmp: string[] = [];
function tempDb(): string {
  const f = path.join(os.tmpdir(), `public-${Date.now()}-${Math.random()}.sqlite`);
  tmp.push(f);
  return f;
}
afterEach(() => {
  for (const f of tmp.splice(0)) {
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(`${f}${suffix}`);
      } catch {
        /* ignore */
      }
    }
  }
});

async function publishOne(svc: CampaignDraftService) {
  const draft = await svc.createDraft({
    operatorId: "op1",
    orgId: "org1",
    createdBy: "dir1",
    brief: {
      sport: "volleyball",
      windowStart: "2027-03-01",
      windowEnd: "2027-04-15",
      rosterSize: 18,
      note: "",
      orgDisplayName: "Lincoln",
      themeKey: "spirit_week",
    },
  });
  return svc.publishDraft("op1", draft.id).campaign;
}

describe("public campaign + checkout", () => {
  it("publish mints a slug, seeds a roster, and the slug resolves without tenant", async () => {
    const db = openDb(tempDb());
    const svc = new CampaignDraftService(db);
    const campaign = await publishOne(svc);

    expect(campaign.slug).toBe("lincoln-volleyball");
    expect(campaign.themeKey).toBe("spirit_week");

    const publicView = svc.getCampaignBySlug("lincoln-volleyball");
    expect(publicView?.id).toBe(campaign.id);

    const roster = svc.listParticipants(campaign.id);
    expect(roster.length).toBeGreaterThan(0);
    expect(roster[0].goalCents).toBe(Math.round(campaign.goalCents / 18));
    expect(svc.getParticipantBySlug(campaign.id, "jordan-lee")?.displayName).toBe("Jordan Lee");
    db.close();
  });

  it("a second publish of the same org gets a de-duplicated slug", async () => {
    const db = openDb(tempDb());
    const svc = new CampaignDraftService(db);
    const first = await publishOne(svc);
    const second = await publishOne(svc);
    expect(first.slug).toBe("lincoln-volleyball");
    expect(second.slug).toBe("lincoln-volleyball-2");
    db.close();
  });

  it("mock checkout records the order and credits the participant and campaign", async () => {
    const db = openDb(tempDb());
    const svc = new CampaignDraftService(db);
    const campaign = await publishOne(svc);
    const tee = campaign.offerProductIds.find((id) => id === "sku_vb_tee")!;

    const order = svc.placeOrder(
      {
        campaignSlug: campaign.slug,
        participantSlug: "jordan-lee",
        supporterName: "Grandma Pat",
        supporterEmail: "pat@example.com",
        lines: [{ productId: tee, qty: 1 }],
        donationCents: 5000,
      },
      500,
    );
    expect(order.status).toBe("paid_mock");
    expect(order.totalCents).toBe(2200 + 499 + 5000);
    expect(order.goalCreditCents).toBe(800 + 4750);

    const jordan = svc.getParticipantBySlug(campaign.id, "jordan-lee")!;
    expect(svc.getProgress(campaign.id, jordan.id).raisedCents).toBe(5550);
    expect(svc.getProgress(campaign.id).raisedCents).toBe(5550);
    expect(svc.getProgress(campaign.id).orderCount).toBe(1);
    db.close();
  });

  it("rejects an empty cart and a bad email", async () => {
    const db = openDb(tempDb());
    const svc = new CampaignDraftService(db);
    const campaign = await publishOne(svc);
    expect(() =>
      svc.placeOrder(
        {
          campaignSlug: campaign.slug,
          participantSlug: null,
          supporterName: "A",
          supporterEmail: "a@b.co",
          lines: [],
          donationCents: 0,
        },
        500,
      ),
    ).toThrow(/Add an item/);
    expect(() =>
      svc.placeOrder(
        {
          campaignSlug: campaign.slug,
          participantSlug: null,
          supporterName: "A",
          supporterEmail: "nope",
          lines: [],
          donationCents: 1000,
        },
        500,
      ),
    ).toThrow(/valid email/);
    db.close();
  });
});
