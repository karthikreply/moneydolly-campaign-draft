import Link from "next/link";
import { PERSONAS } from "@/domain/personas";

const FLOW = ["Host publishes", "Manager launches", "Student shares", "Supporters pay"];

export default function PersonaChooserPage() {
  return (
    <div className="entry">
      <section className="entry-hero">
        <span className="eyebrow">One season, three seats</span>
        <h1>Who are you in this demo?</h1>
        <p className="lede">
          Pick a seat to start. Switch any time from the top bar. Rules set every number, AI writes only
          the words, and a person always publishes.
        </p>
      </section>

      <ol className="entry-cards">
        {PERSONAS.map((p, i) => (
          <li key={p.id} className={`entry-card is-${p.id}`}>
            <div className="entry-card-top">
              <span className="entry-step">{String(i + 1).padStart(2, "0")}</span>
              {p.id === "host" ? <span className="entry-start">Start here</span> : null}
            </div>
            <h2>{p.name}</h2>
            <p className="entry-who">{p.who}</p>
            <p className="entry-promise">{p.promise}</p>
            <ul className="entry-cando">
              {p.canDo.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <Link className={`btn entry-go${p.id === "host" ? "" : " btn-secondary"}`} href={p.home}>
              {p.id === "host" ? "Start here" : "Enter"}
              <span aria-hidden="true"> →</span>
            </Link>
          </li>
        ))}
      </ol>

      <section className="entry-flow" aria-label="How the three personas connect">
        <h2 className="sr-only-inline">How it connects</h2>
        <ol>
          {FLOW.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
