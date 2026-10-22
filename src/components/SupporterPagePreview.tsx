import {
  buildFeePreviewSamples,
  formatCents,
} from "@/domain/campaign-draft/fee-preview";
import { resolveThemePack } from "@/domain/campaign-draft/theme-packs";
import type { CampaignDraft, CatalogSku } from "@/domain/campaign-draft/types";

export function SupporterPagePreview({
  draft,
  catalog,
  donationFeeBps,
}: {
  draft: CampaignDraft;
  catalog: CatalogSku[];
  donationFeeBps?: number;
}) {
  const theme = resolveThemePack(draft.brief.themeKey);
  const skus = catalog.filter((s) => draft.skuIds.includes(s.id));
  const samples = buildFeePreviewSamples(skus, donationFeeBps);
  const products = skus.filter((s) => s.kind === "product");

  return (
    <div
      className="preview"
      style={{
        background: `linear-gradient(160deg, ${theme.colors.background} 0%, ${theme.colors.backgroundAlt} 55%, ${theme.colors.background} 100%)`,
        color: theme.colors.ink,
        borderColor: "var(--operator-primary, " + theme.colors.line + ")",
        fontFamily: theme.fonts.body,
      }}
    >
      <p style={{ marginTop: 0, fontSize: "0.8rem", color: theme.colors.muted }}>
        Supporter preview · {theme.name} · not live checkout
      </p>
      <h2
        style={{
          fontFamily: theme.fonts.display,
          color: theme.colors.ink,
          margin: "0 0 0.5rem",
          fontSize: "1.75rem",
        }}
      >
        {draft.headline || "Headline required"}
      </h2>
      <p style={{ color: theme.colors.ink }}>{draft.supportingLine}</p>
      <p>
        <strong style={{ color: theme.colors.accent }}>Goal:</strong>{" "}
        {formatCents(draft.goalCents)}
      </p>

      <div
        style={{
          display: "inline-block",
          marginTop: "0.35rem",
          padding: "0.35rem 0.7rem",
          borderRadius: 4,
          background: theme.colors.accent,
          color: theme.colors.accentInk,
          fontSize: "0.85rem",
          fontWeight: 600,
        }}
      >
        Shop or donate
      </div>

      <h3 style={{ fontSize: "1rem", marginBottom: "0.35rem", marginTop: "1.25rem" }}>
        Offers
      </h3>
      <ul className="sku-list" style={{ borderColor: theme.colors.line }}>
        {skus.map((s) => (
          <li key={s.id} style={{ borderColor: theme.colors.line }}>
            {s.name}
            {s.kind === "product"
              ? ` — ${formatCents(s.retailCents)}`
              : " — any amount"}
          </li>
        ))}
      </ul>
      {products.length === 0 ? (
        <p style={{ color: theme.colors.muted }}>
          Donation-only draft (empty or filtered catalog).
        </p>
      ) : null}

      <h3 style={{ fontSize: "1rem", marginTop: "1.25rem" }}>
        Where the money goes
      </h3>
      {samples.map((sample) => (
        <div
          className="fee-row"
          key={sample.label}
          style={{ borderColor: theme.colors.line }}
        >
          <div>
            <div>{sample.label}</div>
            <div style={{ color: theme.colors.muted, fontSize: "0.9rem" }}>
              Supporter pays {formatCents(sample.supporterPaysCents)}
            </div>
            {sample.notTowardGoalNote ? (
              <div style={{ color: theme.colors.muted, fontSize: "0.85rem" }}>
                {sample.notTowardGoalNote}
              </div>
            ) : null}
          </div>
          <div style={{ textAlign: "right" }}>
            <div>Program receives</div>
            <strong style={{ color: theme.colors.accent }}>
              {formatCents(sample.programReceivesCents)}
            </strong>
            <div style={{ color: theme.colors.muted, fontSize: "0.85rem" }}>
              Toward goal {formatCents(sample.towardGoalCents)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
