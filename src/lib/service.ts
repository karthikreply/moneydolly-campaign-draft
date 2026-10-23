import { getDb } from "@/db/client";
import { CampaignDraftService } from "@/domain/campaign-draft/campaign-draft-service";

export { DEMO } from "@/lib/demo-tenant";

let service: CampaignDraftService | null = null;

export function getCampaignDraftService(): CampaignDraftService {
  if (!service) service = new CampaignDraftService(getDb());
  return service;
}
