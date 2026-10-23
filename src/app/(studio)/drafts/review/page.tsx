"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DraftReviewLoader } from "@/components/DraftReviewLoader";

function ReviewFromQuery() {
  const id = useSearchParams().get("id");
  if (!id) {
    return (
      <p className="error" role="alert">
        This draft link is missing an id.
      </p>
    );
  }
  return <DraftReviewLoader id={id} />;
}

/** Static page so GitHub Pages can open any draft. The id travels in the query string. */
export default function DraftReviewQueryPage() {
  return (
    <Suspense fallback={<p className="muted">Loading draft…</p>}>
      <ReviewFromQuery />
    </Suspense>
  );
}
