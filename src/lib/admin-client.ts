import { generateTemplatePack } from "@/domain/admin/generate-template-pack";
import {
  deserializeRegistry,
  listPublishedPacks,
  publishPack,
} from "@/domain/admin/presets-and-catalog";
import type { DraftTemplatePack, PublishScope, PublishedTemplatePack } from "@/domain/admin/template-pack-types";
import { isStaticDemo } from "@/lib/is-static-demo";
import { hydrateRegistryFromStorage, writeLocalRegistry } from "@/lib/registry-storage";

export { hydrateRegistryFromStorage } from "@/lib/registry-storage";

export async function adminListPacks(): Promise<PublishedTemplatePack[]> {
  if (isStaticDemo) {
    hydrateRegistryFromStorage();
    return listPublishedPacks();
  }
  const res = await fetch("/api/admin/templates");
  if (!res.ok) throw new Error("Failed to load template registry");
  const body = (await res.json()) as { published: PublishedTemplatePack[] };
  deserializeRegistry(body);
  return body.published;
}

export async function adminGenerate(prompt: string, operatorId: string, scope: PublishScope) {
  if (isStaticDemo) {
    hydrateRegistryFromStorage();
    return generateTemplatePack(prompt, { operatorId, scope });
  }
  const res = await fetch("/api/admin/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "generate", prompt, scope, operatorId }),
  });
  if (!res.ok) throw new Error("Generate failed");
  return (await res.json()) as ReturnType<typeof generateTemplatePack>;
}

export async function adminPublish(
  pack: DraftTemplatePack,
  scope: PublishScope,
  operatorId: string | null,
): Promise<PublishedTemplatePack> {
  if (isStaticDemo) {
    hydrateRegistryFromStorage();
    const published = publishPack(pack, scope, scope === "operator" ? operatorId : null);
    writeLocalRegistry();
    const { resetDemoStore } = await import("@/lib/demo-client");
    resetDemoStore();
    return published;
  }
  const res = await fetch("/api/admin/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "publish", pack, scope, operatorId }),
  });
  if (!res.ok) throw new Error("Publish failed");
  const body = (await res.json()) as PublishedTemplatePack;
  await adminListPacks();
  return body;
}
