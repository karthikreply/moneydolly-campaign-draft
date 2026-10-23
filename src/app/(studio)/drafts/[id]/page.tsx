import { DraftReviewLoader } from "@/components/DraftReviewLoader";

/** Placeholder satisfies static export; real draft ids load client-side after in-app navigation. */
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function DraftReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return <DraftReviewLoader params={params} />;
}
