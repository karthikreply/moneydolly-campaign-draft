import { deserializeRegistry, type RegistrySnapshot } from "@/domain/admin/presets-and-catalog";
import { isStaticDemo } from "@/lib/is-static-demo";
import { hydrateRegistryFromStorage } from "@/lib/registry-storage";

let pending: Promise<void> | null = null;

/**
 * Load Template Studio packs into this browser: localStorage on GitHub Pages, the API on a server.
 * Never call hydrateRegistryFromStorage directly in server mode; an empty store would wipe the registry.
 */
export function loadRegistry(): Promise<void> {
  if (isStaticDemo) {
    hydrateRegistryFromStorage();
    return Promise.resolve();
  }
  pending ??= fetch("/api/admin/templates")
    .then(async (res) => {
      if (!res.ok) throw new Error("Failed to load template registry");
      deserializeRegistry((await res.json()) as RegistrySnapshot);
    })
    .catch((err: unknown) => {
      pending = null;
      throw err;
    });
  return pending;
}

/** Built-in sports and themes still work if the registry can't load. */
export function loadRegistrySafely(): Promise<void> {
  return loadRegistry().catch(() => undefined);
}

export function invalidateRegistry(): void {
  pending = null;
}
