"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCents } from "@/domain/campaign-draft/fee-preview";
import { resolveThemePack } from "@/domain/campaign-draft/theme-packs";
import type {
  CampaignProgress,
  CatalogSku,
  CheckoutQuote,
  Participant,
  PublishedCampaign,
} from "@/domain/campaign-draft/types";
import { feeRateToBps, type OperatorBrand } from "@/domain/operators";
import { apiCheckoutPay, apiCheckoutQuote } from "@/lib/campaign-client";
import { publicCampaignPath } from "@/lib/public-path";

const DONATION_PRESETS = [2500, 5000, 10000];

function daysUntil(iso: string): number | null {
  const end = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(end)) return null;
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((end - start) / 86_400_000);
}

export function PublicCampaignPage({
  campaign,
  participant,
  roster,
  catalog,
  operator,
  progress: initialProgress,
}: {
  campaign: PublishedCampaign;
  participant: Participant | null;
  roster: Participant[];
  catalog: CatalogSku[];
  operator: OperatorBrand;
  progress: CampaignProgress;
}) {
  const theme = resolveThemePack(campaign.themeKey);
  const offers = useMemo(
    () => campaign.offerProductIds.map((id) => catalog.find((s) => s.id === id)).filter(Boolean) as CatalogSku[],
    [campaign.offerProductIds, catalog],
  );
  const products = offers.filter((s) => s.kind === "product");
  const hasDonation = offers.some((s) => s.kind === "donation");
  const feeBps = feeRateToBps(operator.customFeeRate);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [donationCents, setDonationCents] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [progress, setProgress] = useState(initialProgress);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ id: string; totalCents: number; goalCreditCents: number } | null>(null);

  const lines = useMemo(
    () => Object.entries(qty).filter(([, n]) => n > 0).map(([productId, n]) => ({ productId, qty: n })),
    [qty],
  );
  const cartEmpty = lines.length === 0 && donationCents <= 0;

  useEffect(() => {
    if (cartEmpty) {
      setQuote(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void apiCheckoutQuote({
        campaignSlug: campaign.slug,
        participantSlug: participant?.slug ?? null,
        operatorId: operator.id,
        supporterName: "quote",
        supporterEmail: "quote@quote.local",
        lines,
        donationCents,
      })
        .then((data) => {
          if (controller.signal.aborted) return;
          if (data.quote) setQuote(data.quote);
          else setQuote(null);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setQuote(null);
        });
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cartEmpty, lines, donationCents, campaign.slug, participant?.slug, operator.id]);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const data = await apiCheckoutPay({
        campaignSlug: campaign.slug,
        participantSlug: participant?.slug ?? null,
        operatorId: operator.id,
        supporterName: name,
        supporterEmail: email,
        lines,
        donationCents,
      });
      setReceipt(data.order);
      setProgress(data.progress);
      setQty({});
      setDonationCents(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  const pct = progress.goalCents > 0 ? Math.min(100, Math.round((progress.raisedCents / progress.goalCents) * 100)) : 0;
  const daysLeft = campaign.endsAt ? daysUntil(campaign.endsAt) : null;

  return (
    <div
      className="public-page"
      style={
        {
          "--pub-bg": theme.colors.background,
          "--pub-bg-alt": theme.colors.backgroundAlt,
          "--pub-ink": theme.colors.ink,
          "--pub-muted": theme.colors.muted,
          "--pub-panel": theme.colors.panel,
          "--pub-line": theme.colors.line,
          "--pub-accent": theme.colors.accent,
          "--pub-accent-ink": theme.colors.accentInk,
          "--pub-font-body": theme.fonts.body,
          "--pub-font-display": theme.fonts.display,
          "--pub-display-weight": String(theme.displayStyle?.weight ?? 600),
          "--pub-display-tracking": theme.displayStyle?.letterSpacing ?? "-0.02em",
          "--pub-display-transform": theme.displayStyle?.textTransform ?? "none",
          "--operator-primary": operator.primaryColor,
        } as React.CSSProperties
      }
    >
      <a className="skip-link" href="#support-main">
        Skip to campaign
      </a>
      <header className="public-topbar">
        <span className="public-operator">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={operator.logoUrl} alt="" width={28} height={28} />
          <span>{operator.operatorName}</span>
        </span>
        <span className="public-secure">
          Secure checkout
          <span className="public-secure-more"> · mock payments in this prototype</span>
        </span>
      </header>

      <main id="support-main" className="public-grid">
        <section className="public-hero">
          {participant ? (
            <p className="public-kicker">
              You&apos;re supporting <strong>{participant.displayName}</strong> ·{" "}
              <Link href={publicCampaignPath(campaign.slug, null, operator.id)}>view team page</Link>
            </p>
          ) : (
            <p className="public-kicker">{campaign.orgDisplayName} · team page</p>
          )}
          <h1>{campaign.headline}</h1>
          <p className="public-lede">{campaign.supportingLine}</p>

          <div className="public-progress">
            <div
              className="public-progress-bar"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${formatCents(progress.raisedCents)} raised of ${formatCents(progress.goalCents)}`}
            >
              <span style={{ width: `${pct}%` }} />
            </div>
            <div className="public-progress-meta">
              <strong>{formatCents(progress.raisedCents)}</strong> raised of{" "}
              <span className="money">{formatCents(progress.goalCents)}</span>
              {participant ? " personal goal" : " team goal"}
            </div>
            <p className="public-proof">
              {pct}% there
              {daysLeft == null ? "" : daysLeft <= 0 ? " · ends today" : ` · ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
              {" · "}
              {progress.orderCount === 0
                ? "Be the first supporter"
                : `${progress.orderCount} ${progress.orderCount === 1 ? "supporter has" : "supporters have"} given`}
            </p>
          </div>

          {!participant && roster.length > 0 ? (
            <div className="public-roster">
              <h2>Support a specific player</h2>
              <div className="public-roster-grid">
                {roster.map((p) => (
                  <Link key={p.id} href={publicCampaignPath(campaign.slug, p.slug, operator.id)} className="public-roster-chip">
                    {p.displayName}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {products.length > 0 ? (
            <>
              <h2>Shop to support</h2>
              <ul className="public-products">
                {products.map((sku) => {
                  const n = qty[sku.id] ?? 0;
                  return (
                    <li key={sku.id} className="public-product">
                      <div>
                        <div className="public-product-name">{sku.name}</div>
                        <div className="public-product-meta">
                          {formatCents(sku.retailCents)} + {formatCents(sku.shipHandlingCents)} shipping ·{" "}
                          <span className="public-credit">{formatCents(sku.groupCreditCents)} to the program</span>
                        </div>
                      </div>
                      <div className="public-qty">
                        <button type="button" aria-label={`Remove one ${sku.name}`} disabled={n === 0} onClick={() => setQty({ ...qty, [sku.id]: Math.max(0, n - 1) })}>
                          −
                        </button>
                        <span>{n}</span>
                        <button type="button" aria-label={`Add one ${sku.name}`} onClick={() => setQty({ ...qty, [sku.id]: n + 1 })}>
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {hasDonation ? (
            <>
              <h2>Or donate directly</h2>
              <div className="public-donate">
                {DONATION_PRESETS.map((cents) => (
                  <button
                    key={cents}
                    type="button"
                    className={donationCents === cents ? "is-selected" : ""}
                    aria-pressed={donationCents === cents}
                    onClick={() => setDonationCents(donationCents === cents ? 0 : cents)}
                  >
                    {formatCents(cents)}
                    {donationCents === cents ? " selected" : ""}
                  </button>
                ))}
                <label className="public-donate-custom">
                  <span>$</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    aria-label="Other donation amount in dollars"
                    placeholder="Other"
                    value={donationCents > 0 && !DONATION_PRESETS.includes(donationCents) ? donationCents / 100 : ""}
                    onChange={(e) => {
                      const dollars = Number(e.target.value);
                      setDonationCents(
                        e.target.value.trim() === "" || !Number.isFinite(dollars)
                          ? 0
                          : Math.max(0, Math.round(dollars * 100)),
                      );
                    }}
                  />
                </label>
              </div>
              <p className="public-finePrint">
                {operator.operatorName} keeps {(operator.customFeeRate * 100).toFixed(0)}% of donations to run the
                platform; the rest goes to {campaign.orgDisplayName}.
              </p>
            </>
          ) : null}
        </section>

        <aside className="public-checkout">
          {receipt ? (
            <div className="public-receipt">
              <h2>Thank you{name ? `, ${name.split(" ")[0]}` : ""}!</h2>
              <p>
                You paid <strong>{formatCents(receipt.totalCents)}</strong>.{" "}
                <strong className="money">{formatCents(receipt.goalCreditCents)}</strong> counts toward{" "}
                {participant ? `${participant.displayName}'s` : "the team's"} goal.
              </p>
              <p className="public-finePrint">Mock order {receipt.id.slice(0, 8)} · no card was charged.</p>
              <button type="button" className="public-pay" onClick={() => setReceipt(null)}>
                Support again
              </button>
            </div>
          ) : (
            <>
              <h2>Your order</h2>
              {cartEmpty ? (
                <p className="public-muted">Pick an item or a donation amount to get started.</p>
              ) : quote ? (
                <dl className="public-summary">
                  {quote.lines.map((l) => (
                    <div key={l.productId}>
                      <dt>
                        {l.qty} × {l.name}
                      </dt>
                      <dd>{formatCents(l.unitCents * l.qty)}</dd>
                    </div>
                  ))}
                  {quote.donationCents > 0 ? (
                    <div>
                      <dt>Donation</dt>
                      <dd>{formatCents(quote.donationCents)}</dd>
                    </div>
                  ) : null}
                  {quote.shippingCents > 0 ? (
                    <div>
                      <dt>Shipping &amp; handling</dt>
                      <dd>{formatCents(quote.shippingCents)}</dd>
                    </div>
                  ) : null}
                  <div className="public-total">
                    <dt>You pay</dt>
                    <dd>{formatCents(quote.totalCents)}</dd>
                  </div>
                  <div className="public-credit-row">
                    <dt>Program receives</dt>
                    <dd>{formatCents(quote.goalCreditCents)}</dd>
                  </div>
                  {quote.donationFeeCents > 0 ? (
                    <div className="public-finePrint-row">
                      <dt>Platform fee on donation ({(feeBps / 100).toFixed(0)}%)</dt>
                      <dd>−{formatCents(quote.donationFeeCents)}</dd>
                    </div>
                  ) : null}
                  {quote.shippingCents > 0 ? (
                    <p className="public-finePrint">Shipping never counts toward the goal.</p>
                  ) : null}
                </dl>
              ) : (
                <p className="public-muted">Pricing…</p>
              )}

              <label className="public-field">
                <span>Your name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pat Johnson" autoComplete="name" />
              </label>
              <label className="public-field">
                <span>Email for receipt</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pat@example.com" autoComplete="email" />
              </label>

              <div className="public-card-stub" aria-hidden>
                <span>•••• •••• •••• 4242</span>
                <span>Card entry handled by the payment provider in production</span>
              </div>

              {error ? (
                <p className="public-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="button" className="public-pay" disabled={busy || cartEmpty || !quote} onClick={() => void pay()}>
                {busy ? "Processing…" : quote ? `Pay ${formatCents(quote.totalCents)}` : "Add an item or amount to pay"}
              </button>
              <p className="public-finePrint">
                Prototype: this records a mock order and charges nothing.
              </p>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
