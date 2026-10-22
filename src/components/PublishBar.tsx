"use client";

import Link from "next/link";

export function PublishBar({
  canPublish,
  busy,
  onPublish,
}: {
  canPublish: boolean;
  busy: boolean;
  onPublish: () => void;
}) {
  return (
    <div className="publish-bar">
      <Link className="btn btn-secondary" href="/drafts/new">
        Back to brief
      </Link>
      <button
        className="btn btn-accent"
        type="button"
        disabled={!canPublish || busy}
        onClick={onPublish}
      >
        {busy ? "Publishing…" : "Publish"}
      </button>
    </div>
  );
}
