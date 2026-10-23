export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "campaign";
}

/** Org "Lincoln Volleyball" and sport "volleyball" stay "lincoln-volleyball". */
export function campaignSlug(orgName: string, sport: string): string {
  const org = slugify(orgName);
  const sportKey = slugify(sport);
  if (!sportKey || org.includes(sportKey)) return org || sportKey || "campaign";
  return slugify(`${orgName} ${sport}`);
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
