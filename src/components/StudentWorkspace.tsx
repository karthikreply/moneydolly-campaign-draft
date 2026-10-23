"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCents } from "@/domain/campaign-draft/fee-preview";
import type { CampaignProgress, Participant, PublishedCampaign } from "@/domain/campaign-draft/types";
import { apiGetPublicCampaignBundle } from "@/lib/campaign-client";
import { forgetCampaign, lastCampaignSlug, SEED_CAMPAIGN_SLUG } from "@/lib/demo-journey";
import { loadRegistrySafely } from "@/lib/registry-sync";
import { useOperator } from "./OperatorProvider";
import { StudentApp } from "./ParticipantAppPreview";

const PREFERRED_STUDENT = "jordan-lee";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface TeamState {
  campaign: PublishedCampaign;
  roster: Participant[];
  team: CampaignProgress;
  label: string;
}

/** Slugs are "<org>-<sport>" with an optional "-2" suffix; the org name alone can be just "Lincoln". */
function teamLabel(campaign: PublishedCampaign): string {
  const words = campaign.slug.replace(/-\d+$/, "").split("-").filter(Boolean);
  const fromSlug = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return fromSlug.length > campaign.orgDisplayName.length ? fromSlug : campaign.orgDisplayName;
}

function percent(p: CampaignProgress): number {
  return p.goalCents > 0 ? Math.min(100, Math.round((p.raisedCents / p.goalCents) * 100)) : 0;
}

export function StudentWorkspace() {
  const { operator } = useOperator();
  const [team, setTeam] = useState<TeamState | null>(null);
  const [studentSlug, setStudentSlug] = useState<string | null>(null);
  const [mine, setMine] = useState<{ participant: Participant; progress: CampaignProgress } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await loadRegistrySafely();
      let slug = lastCampaignSlug();
      let data = await apiGetPublicCampaignBundle(slug);
      if (!data && slug !== SEED_CAMPAIGN_SLUG) {
        forgetCampaign();
        slug = SEED_CAMPAIGN_SLUG;
        data = await apiGetPublicCampaignBundle(slug);
      }
      if (cancelled) return;
      if (!data) {
        setError("No live campaign yet. Switch to Campaign Manager and publish one.");
        return;
      }
      const roster = data.roster as Participant[];
      setTeam({ campaign: data.campaign, roster, team: data.progress, label: teamLabel(data.campaign) });
      setStudentSlug(roster.find((p) => p.slug === PREFERRED_STUDENT)?.slug ?? roster[0]?.slug ?? null);
    }
    load().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!team || !studentSlug) return;
    let cancelled = false;
    setMine(null);
    apiGetPublicCampaignBundle(team.campaign.slug, studentSlug)
      .then((data) => {
        if (!cancelled && data?.participant) setMine({ participant: data.participant, progress: data.progress });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [team, studentSlug]);

  if (error) {
    return (
      <div className="student-empty">
        <p role="alert">{error}</p>
        <Link className="btn" href="/agent">
          Go to Campaign Manager
        </Link>
      </div>
    );
  }

  if (!team || !mine) return <p className="muted">Loading your fundraiser…</p>;

  const { campaign, roster } = team;
  const { participant, progress } = mine;
  const firstName = participant.displayName.split(" ")[0];
  const payPath = `/c/${campaign.slug}/${participant.slug}?op=${operator.id}`;
  const payUrl = typeof window === "undefined" ? payPath : `${window.location.origin}${BASE_PATH}${payPath}`;
  const mineGoal = progress.goalCents || participant.goalCents;

  async function copy() {
    try {
      await navigator.clipboard.writeText(payUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", payUrl);
    }
  }

  return (
    <div className="student">
      <header className="student-head">
        <div>
          <span className="eyebrow">Student · User</span>
          <div className="student-title-row">
            <h1>{firstName}&apos;s fundraiser</h1>
            <label className="student-picker">
              <span>Viewing as</span>
              <select value={participant.slug} onChange={(e) => setStudentSlug(e.target.value)}>
                {roster.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="lede">
            Your coach launched <strong>{team.label}</strong>.
          </p>
          <ol className="student-steps">
            <li>
              <span className="student-step-mark" aria-hidden="true">1</span>
              Get a guardian&apos;s OK
            </li>
            <li>
              <span className="student-step-mark" aria-hidden="true">2</span>
              Pick five supporters
            </li>
            <li className={copied ? "is-done" : ""}>
              <span className="student-step-mark" aria-hidden="true">{copied ? "✓" : "3"}</span>
              Share your pay link
            </li>
          </ol>
        </div>
      </header>

      <div className="student-grid">
        <StudentApp
          key={participant.slug}
          studentName={participant.displayName}
          orgDisplayName={team.label}
          personalGoalCents={mineGoal}
          raisedCents={progress.raisedCents}
          caption={`${firstName}'s app · ${participant.isMinor ? "minor, guardian consent on" : "adult"}`}
        />

        <div className="student-cards">
          <section className="student-card is-primary" aria-labelledby="pay-heading">
            <h2 id="pay-heading">Your pay link</h2>
            <p className="muted">Every purchase or donation through this link counts toward your goal.</p>
            <code className="student-url">{payUrl}</code>
            <div className="student-actions">
              <button type="button" className="btn btn-accent" onClick={() => void copy()}>
                {copied ? "Copied" : "Copy link"}
              </button>
              <Link className="btn btn-secondary" href={payPath}>
                Open as a supporter
              </Link>
            </div>
          </section>

          <section className="student-card" aria-labelledby="mine-heading">
            <h2 id="mine-heading">Your progress</h2>
            <p className="student-big money">
              {formatCents(progress.raisedCents)} <span>of {formatCents(mineGoal)}</span>
            </p>
            <div
              className="goal-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent({ ...progress, goalCents: mineGoal })}
              aria-label={`${firstName}'s goal progress`}
            >
              <div style={{ width: `${percent({ ...progress, goalCents: mineGoal })}%` }} />
            </div>
            <p className="muted">
              {progress.orderCount} {progress.orderCount === 1 ? "supporter" : "supporters"} so far. Updates
              as soon as someone pays.
            </p>
          </section>

          <section className="student-card" aria-labelledby="team-heading">
            <h2 id="team-heading">Team</h2>
            <p className="student-big money">
              {formatCents(team.team.raisedCents)} <span>of {formatCents(team.team.goalCents)}</span>
            </p>
            <div className="goal-track" aria-hidden="true">
              <div style={{ width: `${percent(team.team)}%` }} />
            </div>
            <p className="muted">
              {roster.length} players.{" "}
              <Link href={`/c/${campaign.slug}?op=${operator.id}`}>Open the team page</Link>
            </p>
          </section>

          <p className="student-fine">
            Minors share only after a guardian approves. Shipping never counts toward any goal.
          </p>
        </div>
      </div>
    </div>
  );
}
