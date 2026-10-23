/** Lets the Student view open the campaign the Campaign Manager just published in this browser. */
const KEY = "fieldfund.lastCampaignSlug";

export const SEED_CAMPAIGN_SLUG = "lincoln-volleyball";

export function rememberCampaign(slug: string): void {
  if (typeof window === "undefined" || !slug) return;
  try {
    window.localStorage.setItem(KEY, slug);
  } catch {
    // Private mode: the Student view falls back to the seed campaign.
  }
}

export function lastCampaignSlug(): string {
  if (typeof window === "undefined") return SEED_CAMPAIGN_SLUG;
  try {
    return window.localStorage.getItem(KEY) ?? SEED_CAMPAIGN_SLUG;
  } catch {
    return SEED_CAMPAIGN_SLUG;
  }
}

export function forgetCampaign(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}
