export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "campaign";
}

export function uniqueSlug(base: string, taken: (candidate: string) => boolean): string {
  let candidate = base;
  let n = 2;
  while (taken(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}
