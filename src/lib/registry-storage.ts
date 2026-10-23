import {
  deserializeRegistry,
  REGISTRY_STORAGE_KEY,
  serializeRegistry,
  type RegistrySnapshot,
} from "@/domain/admin/presets-and-catalog";

function readLocalRegistry(): RegistrySnapshot | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as RegistrySnapshot;
  } catch {
    return undefined;
  }
}

export function writeLocalRegistry(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(serializeRegistry()));
}

export function hydrateRegistryFromStorage(): void {
  deserializeRegistry(readLocalRegistry());
}
