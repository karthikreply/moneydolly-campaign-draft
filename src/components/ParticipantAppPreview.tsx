"use client";

import { useState } from "react";
import { formatCents } from "@/domain/campaign-draft/fee-preview";
import type { CampaignDraft } from "@/domain/campaign-draft/types";
import { useOperator } from "./OperatorProvider";

const CONTACTS = [
  "Grandma Pat",
  "Coach Ruiz",
  "Neighbor Kim",
  "Aunt Dee",
  "Uncle Sol",
  "Ms. Alvarez",
];

const SLOT_COUNT = 5;

interface StudentAppProps {
  studentName: string;
  orgDisplayName: string;
  personalGoalCents: number;
  raisedCents: number;
  caption?: string;
}

/** Draft review shows sample progress; the Student view passes real numbers. */
export function ParticipantAppPreview({ draft }: { draft: CampaignDraft }) {
  const roster = Math.max(draft.brief.rosterSize, 1);
  const personalGoal = Math.round(draft.goalCents / roster);
  return (
    <StudentApp
      studentName="Jordan Lee"
      orgDisplayName={draft.brief.orgDisplayName}
      personalGoalCents={personalGoal}
      raisedCents={Math.round(personalGoal * 0.36)}
    />
  );
}

export function StudentApp({
  studentName,
  orgDisplayName,
  personalGoalCents: personalGoal,
  raisedCents: raised,
  caption = "Participant app · minor · not a live device",
}: StudentAppProps) {
  const { operator } = useOperator();
  const [consent, setConsent] = useState<"locked" | "link-sent" | "approved">("locked");
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [slots, setSlots] = useState<Array<string | null>>(Array(SLOT_COUNT).fill(null));
  const firstName = studentName.split(" ")[0];
  const progress = personalGoal > 0 ? Math.min(100, Math.round((raised / personalGoal) * 100)) : 0;
  const shared = slots.filter(Boolean).length;
  const unlocked = consent === "approved";
  const taken = new Set(slots.filter((name): name is string => Boolean(name)));

  function chooseContact(name: string) {
    if (openSlot == null) return;
    setSlots((current) => current.map((slot, index) => (index === openSlot ? name : slot)));
    setOpenSlot(null);
  }

  return (
    <section className="phone-wrap" aria-label="Participant mobile app preview">
      <p className="muted phone-caption">{caption}</p>
      <div className="phone" style={{ borderColor: "var(--operator-primary)" }}>
        <div className="phone-bar">
          <span
            className="phone-logo"
            style={{ backgroundImage: "var(--operator-logo)" }}
            role="img"
            aria-label={`${operator.operatorName} logo`}
          />
          <strong>{operator.operatorName}</strong>
        </div>
        <h3>{studentName}</h3>
        <p className="phone-sub">{orgDisplayName}</p>
        <p className="phone-metric money">
          Personal goal {formatCents(raised)} of {formatCents(personalGoal)}
        </p>
        <div className="goal-track" aria-hidden="true">
          <div style={{ width: `${progress}%`, background: "var(--operator-primary)" }} />
        </div>
        <p className="phone-metric">Shares sent {shared} of {SLOT_COUNT}</p>

        <div className="slot-board">
          {slots.map((name, index) => (
            <button
              key={index}
              type="button"
              className={unlocked ? "vip-slot vip-slot-open" : "vip-slot"}
              disabled={!unlocked}
              onClick={() => setOpenSlot(index)}
            >
              <span>VIP {index + 1}</span>
              <strong>{name ?? "Empty"}</strong>
            </button>
          ))}
          {!unlocked ? (
            <div className="consent-frost">
              {consent === "locked" ? (
                <button type="button" className="consent-badge" onClick={() => setConsent("link-sent")}>
                  🔒 Guardian Consent Required — Tap to Send Parent Approval Link
                </button>
              ) : (
                <div className="consent-sheet">
                  <p>Approval link ready for {firstName}’s guardian.</p>
                  <button type="button" className="consent-approve" onClick={() => setConsent("approved")}>
                    One-tap approve
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {unlocked && openSlot != null ? (
          <div className="contact-drawer" role="dialog" aria-label={`Choose a supporter for VIP ${openSlot + 1}`}>
            <p>Choose one supporter</p>
            {CONTACTS.map((name) => (
              <button
                key={name}
                type="button"
                disabled={taken.has(name)}
                onClick={() => chooseContact(name)}
              >
                {taken.has(name) ? `${name} already chosen` : name}
              </button>
            ))}
            <button type="button" onClick={() => setOpenSlot(null)}>
              Close
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
