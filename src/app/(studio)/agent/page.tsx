"use client";

import { CampaignAgent } from "@/components/agent/CampaignAgent";
import { STUB_CATALOG } from "@/domain/campaign-draft/stub-catalog";

export default function AgentPage() {
  return <CampaignAgent catalog={STUB_CATALOG} />;
}
