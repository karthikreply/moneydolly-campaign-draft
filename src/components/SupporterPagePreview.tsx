import {
  buildFeePreviewSamples,
  formatCents,
} from "@/domain/campaign-draft/fee-preview";
import type { CampaignDraft, CatalogSku } from "@/domain/campaign-draft/types";

export function SupporterPagePreview({
  draft,
  catalog,
}: {
  draft: CampaignDraft;
  catalog: CatalogSku[];
}) {
  const skus = catalog.filter((s) => draft.skuIds.includes(s.id));
  const samples = buildFeePreviewSamples(skus);
  const products = skus.filter((s) => s.kind === "product");

  return (
    <div className="preview">
      <p className="muted" style={{ marginTop: 0, fontSize: "0.8rem" }}>
        Supporter preview · not live checkout
      </p>
      <h2>{draft.headline || "Headline required"}</h2>
      <p>{draft.supportingLine}</p>
      <p>
        <strong>Goal:</strong> {formatCents(draft.goalCents)}
      </p>

      <h3 style={{ fontSize: "1rem", marginBottom: "0.35rem" }}>Offers</h3>
      <ul className="sku-list">
        {skus.map((s) => (
          <li key={s.id}>
            {s.name}
            {s.kind === "product"
              ? ` — ${formatCents(s.retailCents)}`
              : " — any amount"}
          </li>
        ))}
      </ul>
      {products.length === 0 ? (
        <p className="muted">Donation-only draft (empty or filtered catalog).</p>
      ) : null}

      <h3 style={{ fontSize: "1rem", marginTop: "1.25rem" }}>
        Where the money goes
      </h3>
      {samples.map((sample) => (
        <div className="fee-row" key={sample.label}>
          <div>
            <div>{sample.label}</div>
            <div className="muted">
              Supporter pays {formatCents(sample.supporterPaysCents)}
            </div>
            {sample.notTowardGoalNote ? (
              <div className="muted">{sample.notTowardGoalNote}</div>
            ) : null}
          </div>
          <div style={{ textAlign: "right" }}>
            <div>Program receives</div>
            <strong>{formatCents(sample.programReceivesCents)}</strong>
            <div className="muted">
              Toward goal {formatCents(sample.towardGoalCents)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
