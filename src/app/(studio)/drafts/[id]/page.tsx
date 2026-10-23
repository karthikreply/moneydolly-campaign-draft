import { DraftReviewFromParams } from "@/components/DraftReviewLoader";

/** Placeholder satisfies static export. Live drafts open at /drafts/review?id= */
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function DraftReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return <DraftReviewFromParams params={params} />;
}
