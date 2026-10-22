import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">Campaign Draft Agent</span>
          <h1>Launch a season fundraiser in one conversation.</h1>
          <p className="lede">
            Tell the agent your sport, roster, and dates. Rules set the goal and the
            products; AI writes the words; you approve and publish.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-accent" href="/agent">
              Talk to the agent
            </Link>
            <Link className="btn btn-secondary" href="/drafts/new">
              Start from a brief
            </Link>
          </div>
        </div>
        <aside className="hero-card" aria-label="How a draft is built">
          <span className="eyebrow">What the rules decide</span>
          <h2>Numbers never come from the model.</h2>
          <dl>
            <div>
              <dt>Goal</dt>
              <dd>roster × $/player</dd>
            </div>
            <div>
              <dt>Offers</dt>
              <dd>≤ 5 SKUs</dd>
            </div>
            <div>
              <dt>Fees</dt>
              <dd>itemized</dd>
            </div>
            <div>
              <dt>Publish</dt>
              <dd>you, always</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="feature-grid" aria-label="How it works">
        <article className="feature">
          <div className="num">01</div>
          <h3>Say it once</h3>
          <p>Voice or text. The agent asks only for what is missing and fills the rest with safe defaults.</p>
        </article>
        <article className="feature">
          <div className="num">02</div>
          <h3>Review a real page</h3>
          <p>Edit on the left, see the supporter page and the student app on the right, with every fee shown.</p>
        </article>
        <article className="feature">
          <div className="num">03</div>
          <h3>Publish and share</h3>
          <p>One team link, one link per player. Shipping never counts toward the goal.</p>
        </article>
      </section>
    </>
  );
}
