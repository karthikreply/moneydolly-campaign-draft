"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PERSONAS, personaForPath } from "@/domain/personas";
import { OperatorSwitcher } from "./OperatorSwitcher";

export function StudioTopbar() {
  const pathname = usePathname() ?? "/";
  const persona = personaForPath(pathname);

  return (
    <>
      <p className="demo-banner" role="status">
        {persona ? persona.banner : "Shared demo. Pick a persona to start."}
      </p>
      <header className="topbar">
        <Link href="/" className="brand-lockup" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="operator-mark" role="img" aria-label="Operator logo" />
          <span>
            <p className="brand">
              Field<span>Fund</span>
            </p>
            <p className="brand-sub">{persona ? `${persona.name} · ${persona.surface}` : "Choose a persona"}</p>
          </span>
        </Link>

        <nav className="persona-switch" aria-label="Switch persona">
          {PERSONAS.map((p) => (
            <Link
              key={p.id}
              href={p.home}
              className="persona-switch-item"
              aria-current={persona?.id === p.id ? "page" : undefined}
            >
              <span className={`persona-dot is-${p.id}`} aria-hidden="true" />
              <span className="persona-switch-name" data-short={p.id === "manager" ? "Manager" : p.name}>
                {p.name}
              </span>
              <span className="persona-switch-surface">{p.surface}</span>
            </Link>
          ))}
        </nav>

        {persona && persona.nav.length > 1 ? (
          <nav className="studio-nav" aria-label={`${persona.name} pages`}>
            {persona.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.match.some((m) => pathname.startsWith(m)) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <OperatorSwitcher />
      </header>
    </>
  );
}
