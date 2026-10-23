import { StudioTopbar } from "@/components/StudioTopbar";

/** Host, Campaign Manager, and Student chrome. Public supporter pages live in the (public) group and never render this. */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#studio-main">
        Skip to content
      </a>
      <StudioTopbar />
      <main id="studio-main" className="studio-main">
        {children}
      </main>
    </div>
  );
}
