import { CampaignAgent } from "@/components/agent/CampaignAgent";
import { getCampaignDraftService } from "@/lib/service";

export const dynamic = "force-dynamic";

export default function AgentPage() {
  return (
    <main>
      <CampaignAgent catalog={getCampaignDraftService().getCatalog()} />
    </main>
  );
}
