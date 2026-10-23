import type { CampaignBrief, CampaignDraft } from "@/domain/campaign-draft/types";
import type { CheckoutInput } from "@/domain/campaign-draft/types";
import * as demo from "@/lib/demo-client";
import { rememberCampaign } from "@/lib/demo-journey";
import { isStaticDemo } from "@/lib/is-static-demo";

/** `brandId` is the operator from the top-bar switcher, so its Template Studio packs apply. */
export async function apiCreateDraft(brief: CampaignBrief, brandId?: string): Promise<CampaignDraft> {
  if (isStaticDemo) return demo.createDraft(brief, brandId);
  const res = await fetch("/api/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...brief, brandId }),
  });
  const data = (await res.json()) as CampaignDraft & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Draft failed");
  return data;
}

export async function apiIntakeUtterance(utterance: string) {
  if (isStaticDemo) return demo.intakeUtterance(utterance);
  const res = await fetch("/api/omni", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ utterance }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not draft that brief");
  return data;
}

export async function apiUpdateDraft(
  id: string,
  patch: Partial<{
    goalCents: number;
    surfaceOrder: CampaignDraft["surfaceOrder"];
    skuIds: string[];
    headline: string;
    supportingLine: string;
    whyDraft: string;
  }>,
): Promise<CampaignDraft> {
  if (isStaticDemo) return demo.updateDraft(id, patch);
  const res = await fetch(`/api/drafts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as CampaignDraft & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Save failed");
  return data;
}

export async function apiPublishDraft(id: string) {
  const data = isStaticDemo ? await demo.publishDraft(id) : await publishOnServer(id);
  if (data?.campaign?.slug) rememberCampaign(data.campaign.slug);
  return data;
}

async function publishOnServer(id: string) {
  const res = await fetch(`/api/drafts/${id}/publish`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Publish failed");
  return data;
}

export async function apiGetDraftBundle(id: string) {
  if (isStaticDemo) return demo.getDraftBundle(id);
  const res = await fetch(`/api/drafts/${id}?bundle=1`);
  if (res.status === 404) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Load failed");
  return data as NonNullable<Awaited<ReturnType<typeof demo.getDraftBundle>>>;
}

export async function apiGetPublicCampaignBundle(slug: string, participantSlug?: string | null) {
  if (isStaticDemo) return demo.getPublicCampaignBundle(slug, participantSlug);
  const q = new URLSearchParams({ slug });
  if (participantSlug) q.set("participant", participantSlug);
  const res = await fetch(`/api/public/campaign?${q.toString()}`);
  if (res.status === 404) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Load failed");
  return data;
}

export async function apiCheckoutQuote(body: CheckoutInput & { operatorId: string }) {
  if (isStaticDemo) {
    const quote = await demo.quoteCheckout(body, body.operatorId);
    return { quote };
  }
  const res = await fetch("/api/public/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, mode: "quote" }),
  });
  return res.json();
}

export async function apiCheckoutPay(body: CheckoutInput & { operatorId: string }) {
  if (isStaticDemo) return demo.payCheckout(body, body.operatorId);
  const res = await fetch("/api/public/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, mode: "pay" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Checkout failed");
  return data;
}
