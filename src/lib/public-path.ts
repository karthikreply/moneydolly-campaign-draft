/** Pay-page URL that exists on GitHub Pages for every campaign, not only the seeded one. */
export function publicCampaignPath(slug: string, participant?: string | null, operatorId?: string): string {
  const q = new URLSearchParams({ slug });
  if (participant) q.set("participant", participant);
  if (operatorId) q.set("op", operatorId);
  return `/c/view?${q.toString()}`;
}
