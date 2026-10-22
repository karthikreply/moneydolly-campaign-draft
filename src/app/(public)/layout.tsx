/** Supporter-facing surface: no director chrome, operator brand only. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="public-root">{children}</div>;
}
