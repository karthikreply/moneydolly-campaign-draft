import { BriefForm } from "@/components/BriefForm";

export default function NewDraftPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">New campaign</span>
          <h1>Campaign brief</h1>
          <p>Say it in one line, or fill the form. Either way the rules engine builds the draft.</p>
        </div>
      </div>
      <BriefForm />
    </>
  );
}
