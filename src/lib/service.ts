import { getDb } from "@/db/client";
import { CampaignDraftService } from "@/domain/campaign-draft/campaign-draft-service";

let service: CampaignDraftService | null = null;

export function getCampaignDraftService(): CampaignDraftService {
  if (!service) service = new CampaignDraftService(getDb());
  return service;
}

/** Demo tenant context for the pilot console. */
export const DEMO = {
  operatorId: "op_demo",
  orgId: "org_lincoln",
  createdBy: "director_demo",
} as const;
