import type { NoteFilterResult } from "@/domain/campaign-draft/types";

export function NoteFilterBadge({ filter }: { filter: NoteFilterResult }) {
  const active = filter.type !== "none";
  return (
    <span className={`badge ${active ? "badge-active" : ""}`} title={filter.label}>
      {filter.label}
    </span>
  );
}
