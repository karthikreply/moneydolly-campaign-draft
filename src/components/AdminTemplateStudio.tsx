"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { contrast, minTextContrast } from "@/domain/admin/aaa-palette";
import { generateTemplatePack, typicalRosterFor } from "@/domain/admin/generate-template-pack";
import {
  CAPABILITIES,
  composePrompt,
  interpretTemplateMessage,
  type PreviewTabKey,
  type TemplateSpec,
} from "@/domain/admin/template-conversation";
import type {
  BuildStepStatus,
  DraftTemplatePack,
  GenerateTemplatePackResult,
  PublishedTemplatePack,
  PublishScope,
} from "@/domain/admin/template-pack-types";
import { formatCents } from "@/domain/campaign-draft/fee-preview";
import { adminGenerate, adminListPacks, adminPublish } from "@/lib/admin-client";
import { useOperator } from "@/components/OperatorProvider";

const GALLERY = [
  "Spring Lacrosse template with neon green accents, min goal $2,000, max $8,000, and 5 merch items under $35.",
  "Fall Football template with maroon accents, min goal $5,000, max $20,000, and 6 apparel items under $45.",
  "Winter Hockey template with navy blue accents, min goal $3,000, max $12,000, and 4 gear items under $30.",
  "Summer Softball template with orange accents, min goal $1,500, max $6,000, and 5 items under $25.",
  "Spirit Volleyball template with teal accents, min goal $2,000, max $9,000, and 5 merch items under $30.",
  "Community Band template with purple accents, min goal $1,000, max $5,000, and 4 merch items under $25.",
];

const GREETING =
  "Hi, I build template packs from plain English. Pick a ready-made template, or tell me the sport, colours, goal limits, and items. Then ask for changes the way you'd say them.";

const STEP_REVEAL_MS = 140;

const STATUS_LABEL: Record<BuildStepStatus, string> = {
  found: "From your request",
  assumed: "Assumed",
  missing: "Needed",
};

const STATUS_MARK: Record<BuildStepStatus, string> = {
  found: "✓",
  assumed: "~",
  missing: "!",
};

const TAB_LABEL: Record<PreviewTabKey, string> = {
  supporter: "supporter page",
  brief: "director brief",
  tokens: "theme and contrast",
};

type ChatMessage =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "agent"; kind: "text"; text: string; suggestions?: string[] }
  | { id: number; role: "agent"; kind: "build"; result: GenerateTemplatePackResult; changes: string[] }
  | { id: number; role: "agent"; kind: "published"; pack: PublishedTemplatePack; scopeLabel: string }
  | { id: number; role: "agent"; kind: "help" };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewMessage = DistributiveOmit<ChatMessage, "id">;

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function createRecognizer(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  return rec;
}

function themeVars(pack: DraftTemplatePack): React.CSSProperties {
  const c = pack.theme.colors;
  return {
    "--t-accent": c.accent,
    "--t-accent-ink": c.accentInk,
    "--t-bg": c.background,
    "--t-bg-alt": c.backgroundAlt,
    "--t-ink": c.ink,
    "--t-muted": c.muted,
    "--t-panel": c.panel,
    "--t-line": c.line,
  } as React.CSSProperties;
}

function cssVarBlock(pack: DraftTemplatePack): string {
  const c = pack.theme.colors;
  return [
    `--theme-accent: ${c.accent};`,
    `--theme-accent-ink: ${c.accentInk};`,
    `--theme-bg: ${c.background};`,
    `--theme-bg-alt: ${c.backgroundAlt};`,
    `--theme-ink: ${c.ink};`,
    `--theme-muted: ${c.muted};`,
    `--theme-panel: ${c.panel};`,
    `--theme-line: ${c.line};`,
  ].join("\n");
}

function sampleGoalCents(pack: DraftTemplatePack): { goal: number; roster: number } {
  const p = pack.sportPreset;
  const roster = typicalRosterFor(p.sportKey);
  let goal = roster * p.dollarsPerPlayerCents;
  if (p.minGoalCents != null) goal = Math.max(goal, p.minGoalCents);
  if (p.maxGoalCents != null) goal = Math.min(goal, p.maxGoalCents);
  return { goal, roster };
}

function limitsLabel(pack: DraftTemplatePack): string {
  const { minGoalCents: min, maxGoalCents: max } = pack.sportPreset;
  const whole = (c: number) => `$${Math.round(c / 100).toLocaleString("en-US")}`;
  if (min != null && max != null) return `${whole(min)} – ${whole(max)}`;
  if (min != null) return `From ${whole(min)}`;
  if (max != null) return `Up to ${whole(max)}`;
  return "No limits";
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AdminTemplateStudio() {
  const { operator } = useOperator();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: "agent", kind: "text", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [spec, setSpec] = useState<TemplateSpec | null>(null);
  const [result, setResult] = useState<GenerateTemplatePackResult | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<PreviewTabKey>("supporter");
  const [scope, setScope] = useState<PublishScope>("platform");
  const [published, setPublished] = useState<PublishedTemplatePack | null>(null);
  const [live, setLive] = useState<PublishedTemplatePack[]>([]);
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef(1);
  const threadRef = useRef<HTMLOListElement>(null);
  const recognizer = useRef<SpeechRec | null>(null);

  const pack = result?.canPublish ? result.pack : null;
  const steps = result?.steps ?? [];
  const running = busy || (result !== null && revealed < steps.length);
  const latestBuildId = [...messages].reverse().find((m) => m.role === "agent" && m.kind === "build")?.id;
  /** Page 1 is the gallery and the opening line; page 2 is the conversation once it starts. */
  const stage: "start" | "build" = messages.length > 1 ? "build" : "start";

  const gallery = useMemo(
    () => GALLERY.map((prompt) => ({ prompt, pack: generateTemplatePack(prompt).pack })),
    [],
  );
  const liveKeys = useMemo(() => new Set(live.map((p) => p.theme.key)), [live]);

  useEffect(() => {
    void adminListPacks()
      .then(setLive)
      .catch(() => setLive([]));
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      recognizer.current?.stop();
    },
    [],
  );

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    if (messages.length <= 2) {
      el.scrollTop = 0;
      return;
    }
    const last = el.querySelector(":scope > li:last-of-type");
    if (last instanceof HTMLElement) {
      const top = last.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      el.scrollTop = top;
    }
  }, [messages, revealed]);

  const reveal = useCallback((count: number) => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (prefersReducedMotion()) {
      setRevealed(count);
      return;
    }
    setRevealed(0);
    timerRef.current = window.setInterval(() => {
      setRevealed((n) => {
        if (n + 1 >= count && timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return Math.min(count, n + 1);
      });
    }, STEP_REVEAL_MS);
  }, []);

  function goToStart() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    recognizer.current?.stop();
    setListening(false);
    setMicNote(null);
    idRef.current = 1;
    setMessages([{ id: 0, role: "agent", kind: "text", text: GREETING }]);
    setSpec(null);
    setResult(null);
    setRevealed(0);
    setPublished(null);
    setInput("");
  }

  function push(message: NewMessage) {
    const id = idRef.current++;
    setMessages((m) => [...m, { ...message, id } as ChatMessage]);
  }

  function scopeLabelFor(s: PublishScope): string {
    return s === "platform" ? "every operator" : operator.operatorName;
  }

  async function publish(target: PublishScope) {
    if (!pack) return;
    setScope(target);
    setBusy(true);
    try {
      const done = await adminPublish(pack, target, operator.id);
      setPublished(done);
      setLive(await adminListPacks());
      push({ role: "agent", kind: "published", pack: done, scopeLabel: scopeLabelFor(target) });
    } catch (err) {
      push({ role: "agent", kind: "text", text: err instanceof Error ? err.message : "Publish failed." });
    } finally {
      setBusy(false);
    }
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    push({ role: "user", text });
    const turn = interpretTemplateMessage(text, spec, { operatorName: operator.operatorName });

    switch (turn.type) {
      case "reset":
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        setSpec(null);
        setResult(null);
        setRevealed(0);
        setPublished(null);
        push({ role: "agent", kind: "text", text: "Cleared. Pick a ready-made template or describe a new season." });
        return;
      case "help":
        push({ role: "agent", kind: "help" });
        return;
      case "preview":
        if (!pack) {
          push({ role: "agent", kind: "text", text: "Build a pack first, then I can show it." });
          return;
        }
        setTab(turn.tab);
        push({ role: "agent", kind: "text", text: `Showing the ${TAB_LABEL[turn.tab]} on the right.` });
        return;
      case "publish":
        if (!pack) {
          push({ role: "agent", kind: "text", text: "Nothing to publish yet. Describe a season or pick a template." });
          return;
        }
        await publish(turn.scope ?? scope);
        return;
      case "unknown":
        push({
          role: "agent",
          kind: "text",
          text: pack
            ? "I can change the season, colours, goal limits, item cap, item count, or the mix, and publish when you're ready."
            : "Tell me a sport or program to start, or pick a ready-made template.",
          suggestions: pack
            ? ["Make it fall", "Cap items at $25", "Publish it for everyone"]
            : ["Spring lacrosse, neon green, 5 merch under $35", "What can you do?"],
        });
        return;
      case "build": {
        setBusy(true);
        setPublished(null);
        try {
          const next = await adminGenerate(turn.prompt, operator.id, scope);
          setSpec(turn.spec);
          setResult(next);
          push({ role: "agent", kind: "build", result: next, changes: turn.changes });
          reveal(next.steps.length);
        } catch (err) {
          push({ role: "agent", kind: "text", text: err instanceof Error ? err.message : "Build failed." });
        } finally {
          setBusy(false);
        }
      }
    }
  }

  function toggleMic() {
    const rec = recognizer.current ?? createRecognizer();
    if (!rec) {
      setMicNote("Microphone is unavailable in this browser. Type instead.");
      return;
    }
    recognizer.current = rec;
    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }
    rec.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i]?.[0]?.transcript ?? "";
        if (event.results[i]?.isFinal) finalText += chunk;
        else interim += chunk;
      }
      if (interim.trim()) setInput(interim);
      if (finalText.trim()) {
        setMicNote(null);
        void send(finalText);
      }
    };
    rec.onerror = () => {
      setListening(false);
      setMicNote("Could not hear that. Type instead.");
    };
    rec.onend = () => setListening(false);
    setMicNote("Listening. I send when you pause.");
    setListening(true);
    rec.start();
  }

  const contrastRatio = useMemo(() => (pack ? minTextContrast(pack.theme.colors) : null), [pack]);
  const briefHrefFor = (p: DraftTemplatePack) =>
    `/drafts/new?sport=${encodeURIComponent(p.sportPreset.sportKey)}&theme=${encodeURIComponent(p.theme.key)}`;

  if (stage === "start") {
    return (
      <div className="ats ats-start">
        <header className="ats-start-head">
          <div>
            <span className="eyebrow">Host · Admin</span>
            <h1>Describe a season. The agent builds the pack.</h1>
          </div>
          {live.length ? (
            <p className="ats-registry-pill">
              <strong>{live.length}</strong> {live.length === 1 ? "template" : "templates"} already live —{" "}
              {live[live.length - 1].theme.name} was the latest.
            </p>
          ) : null}
        </header>

        <div className="ats-start-split">
        <section className="ats-gallery" aria-labelledby="ats-gallery-heading">
          <div className="ats-section-head">
            <h2 id="ats-gallery-heading">Ready-made templates</h2>
            <p className="ats-section-note">One tap starts the conversation. Then change anything by asking.</p>
          </div>
          <ul>
            {gallery.map(({ prompt, pack: g }) => (
              <li key={g.theme.key}>
                <button type="button" className="ats-tpl" onClick={() => void send(prompt)} disabled={busy}>
                  <span
                    className="ats-tpl-band"
                    style={{ background: `linear-gradient(120deg, ${g.theme.colors.accent} 0 46%, ${g.theme.colors.backgroundAlt} 46% 100%)` }}
                  >
                    {liveKeys.has(g.theme.key) ? <span className="ats-tpl-live">Live</span> : null}
                  </span>
                  <span className="ats-tpl-name">{g.theme.name}</span>
                  <span className="ats-tpl-meta">
                    {limitsLabel(g)} · {g.catalogSkus.length} items
                  </span>
                  <span className="ats-tpl-cta">Use template →</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="ats-start-compose" aria-labelledby="ats-start-compose-heading">
          <h2 id="ats-start-compose-heading">Or describe your own</h2>
          <form
            className="ats-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor="ats-input" className="sr-only-inline">
              Message the template agent
            </label>
            <textarea
              id="ats-input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Describe a season: sport, colours, goal limits, items…"
              disabled={busy}
            />
            <div className="ats-composer-row">
              <button
                type="button"
                className={"ats-mic" + (listening ? " is-on" : "")}
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? "Stop listening" : "Speak your request"}
              >
                <span aria-hidden="true">{listening ? "■" : "🎙"}</span>
                {listening ? "Listening" : "Speak"}
              </button>
              <span className="ats-hint">{micNote ?? "Enter to send"}</span>
              <button type="submit" className="ats-send" disabled={busy || !input.trim()}>
                Send
              </button>
            </div>
          </form>
          <div className="ats-chips">
            {CAPABILITIES[0].examples.map((ex) => (
              <button key={ex} type="button" onClick={() => void send(ex)} disabled={busy}>
                {ex}
              </button>
            ))}
            <button type="button" onClick={() => void send("What can you do?")} disabled={busy}>
              What can you do?
            </button>
          </div>
        </section>
        </div>
      </div>
    );
  }

  return (
    <div className="ats ats-build">
      <div className="ats-build-head">
        <button type="button" className="btn btn-secondary btn-sm ats-back" onClick={goToStart} disabled={busy}>
          ← Start over
        </button>
        <div className="ats-build-head-info">
          <span className="eyebrow">Host · Admin</span>
          <h1>{pack ? pack.theme.name : "Building your template…"}</h1>
        </div>
        <span className={"ats-state" + (running ? " is-live" : "")}>
          {running ? "Working" : pack ? (published ? "Live" : "Ready to publish") : result ? "Needs input" : "Listening"}
        </span>
      </div>

      <div className="ats-grid">
        <section className="ats-chat" aria-labelledby="ats-chat-heading">
          <h2 id="ats-chat-heading" className="sr-only-inline">
            Template agent conversation
          </h2>

          <ol className="ats-thread" ref={threadRef} role="log" aria-live="polite" aria-label="Conversation">
            {messages.map((m) =>
              m.role === "user" ? (
                <li key={m.id} className="ats-msg is-user">
                  <p>{m.text}</p>
                </li>
              ) : (
                <li key={m.id} className="ats-msg is-agent">
                  <AgentMessage
                    message={m}
                    isLatestBuild={m.kind === "build" && m.id === latestBuildId}
                    revealed={revealed}
                    busy={busy}
                    onSend={(t) => void send(t)}
                    briefHrefFor={briefHrefFor}
                  />
                </li>
              ),
            )}
            {busy ? (
              <li className="ats-msg is-agent is-typing" aria-label="Agent is working">
                <span />
                <span />
                <span />
              </li>
            ) : null}
          </ol>

          <form
            className={"ats-composer" + (running ? " is-running" : "")}
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor="ats-input" className="sr-only-inline">
              Message the template agent
            </label>
            <textarea
              id="ats-input"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={
                pack
                  ? "Ask for a change: “make it fall”, “cap items at $25”, “publish it for everyone”"
                  : "Describe a season: sport, colours, goal limits, items…"
              }
              disabled={busy}
            />
            <div className="ats-composer-row">
              <button
                type="button"
                className={"ats-mic" + (listening ? " is-on" : "")}
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? "Stop listening" : "Speak your request"}
              >
                <span aria-hidden="true">{listening ? "■" : "🎙"}</span>
                {listening ? "Listening" : "Speak"}
              </button>
              <span className="ats-hint">{micNote ?? "Enter to send"}</span>
              <button type="submit" className="ats-send" disabled={busy || !input.trim()}>
                Send
              </button>
            </div>
          </form>

          <div className="ats-chat-tools">
          <details className="ats-possible">
            <summary>What you can ask</summary>
            <div className="ats-possible-grid">
              {CAPABILITIES.map((group) => (
                <div key={group.title}>
                  <h3>{group.title}</h3>
                  <div className="ats-chips">
                    {group.examples.map((ex) => (
                      <button key={ex} type="button" onClick={() => void send(ex)} disabled={busy}>
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>

          {pack ? (
            <details className="ats-dev">
              <summary>Developer view</summary>
              <h3>Working sentence</h3>
              <pre>{spec ? composePrompt(spec) : ""}</pre>
              <h3>CSS variables</h3>
              <pre>{cssVarBlock(pack)}</pre>
              <h3>Sport preset</h3>
              <pre>{JSON.stringify(pack.sportPreset, null, 2)}</pre>
              <h3>Catalog SKUs</h3>
              <pre>{JSON.stringify(pack.catalogSkus, null, 2)}</pre>
            </details>
          ) : null}
          </div>
        </section>

        <section className="ats-preview" aria-labelledby="ats-preview-heading">
          <div className="ats-section-head">
            <h2 id="ats-preview-heading">What directors and supporters get</h2>
          </div>
          <div className="segmented" role="group" aria-label="Preview">
            {(
              [
                ["supporter", "Supporter page"],
                ["brief", "Director brief"],
                ["tokens", "Theme"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          <div className="browser ats-frame">
            <div className="browser-bar">
              <span className="browser-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="browser-url">
                {tab === "brief"
                  ? "/drafts/new"
                  : `/c/lincoln-${pack?.sportPreset.sportKey || "team"}`}
              </span>
            </div>
            {!pack ? (
              <div className="ats-empty">
                <p>The preview fills in as the agent builds.</p>
              </div>
            ) : tab === "supporter" ? (
              <SupporterPreview pack={pack} />
            ) : tab === "brief" ? (
              <BriefPreview pack={pack} />
            ) : (
              <TokenPreview pack={pack} />
            )}
          </div>
        </section>
      </div>

      <div className="ats-dock" role="region" aria-label="Publish">
        {published ? (
          <div className="ats-dock-done" role="status">
            <span className="ats-mark is-found" aria-hidden="true">
              ✓
            </span>
            <p>
              <strong>Live.</strong> {published.theme.name} is ready. Switch to Campaign Manager to launch with it.
            </p>
            <Link className="btn btn-sm" href="/agent">
              Switch to Campaign Manager →
            </Link>
            <Link className="btn btn-secondary btn-sm" href={briefHrefFor(published)}>
              Open in Brief
            </Link>
          </div>
        ) : (
          <>
            <div className="segmented ats-scope" role="group" aria-label="Publish scope">
              <button type="button" aria-pressed={scope === "platform"} onClick={() => setScope("platform")}>
                Platform
              </button>
              <button type="button" aria-pressed={scope === "operator"} onClick={() => setScope("operator")}>
                {operator.operatorName}
              </button>
            </div>
            <p className="ats-dock-summary">
              {pack
                ? `${pack.sportPreset.displayName} · ${pack.catalogSkus.length} items · ${limitsLabel(pack)} · ${
                    contrastRatio != null && contrastRatio >= 7 ? "Readable on all screens" : "Check the colours"
                  } · for ${scopeLabelFor(scope)}`
                : "Build a pack to publish it. Or just say “publish it for everyone”."}
            </p>
            <button type="button" className="btn ats-publish" onClick={() => void publish(scope)} disabled={busy || !pack || running}>
              Publish template
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AgentMessage({
  message,
  isLatestBuild,
  revealed,
  busy,
  onSend,
  briefHrefFor,
}: {
  message: Exclude<ChatMessage, { role: "user" }>;
  isLatestBuild: boolean;
  revealed: number;
  busy: boolean;
  onSend: (text: string) => void;
  briefHrefFor: (p: DraftTemplatePack) => string;
}) {
  if (message.kind === "text") {
    return (
      <>
        <p>{message.text}</p>
        {message.suggestions?.length ? (
          <div className="ats-chips">
            {message.suggestions.map((s) => (
              <button key={s} type="button" onClick={() => onSend(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  if (message.kind === "help") {
    return (
      <>
        <p>Here&apos;s what I can do. Tap any line to try it.</p>
        <ul className="ats-help">
          {CAPABILITIES.map((g) => (
            <li key={g.title}>
              <strong>{g.title}</strong>
              <div className="ats-chips">
                {g.examples.map((ex) => (
                  <button key={ex} type="button" onClick={() => onSend(ex)} disabled={busy}>
                    {ex}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (message.kind === "published") {
    return (
      <>
        <p>
          <strong>{message.pack.theme.name}</strong> is live for {message.scopeLabel}. Campaign managers now see{" "}
          {message.pack.sportPreset.displayName} in the Brief and the Agent.
        </p>
        <div className="ats-chips">
          <Link href={briefHrefFor(message.pack)}>Open in Brief</Link>
          <Link href="/agent">Try it as Campaign Manager</Link>
        </div>
      </>
    );
  }

  const { result, changes } = message;
  const shown = isLatestBuild ? revealed : result.steps.length;
  const done = shown >= result.steps.length;
  const p = result.canPublish ? result.pack : null;
  return (
    <>
      {changes.length ? (
        <div className="ats-changes" aria-label="What changed">
          {changes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      ) : null}
      <p>{done ? result.reply : "Reading your request…"}</p>
      <ol className="ats-steps">
        {result.steps.map((step, i) => (
          <li
            key={step.id}
            className={`ats-step is-${step.status}` + (i < shown ? " is-shown" : "")}
            aria-hidden={i >= shown}
          >
            <span className="ats-mark" aria-hidden="true">
              {STATUS_MARK[step.status]}
            </span>
            <div className="ats-step-body">
              <div className="ats-step-top">
                <span className="ats-step-label">{step.label}</span>
                <span className="ats-tag">{STATUS_LABEL[step.status]}</span>
              </div>
              <p className="ats-step-value">
                {step.id === "look" && p ? (
                  <span className="ats-dots" aria-hidden="true">
                    <i style={{ background: p.theme.colors.accent }} />
                    <i style={{ background: p.theme.colors.background }} />
                    <i style={{ background: p.theme.colors.ink }} />
                  </span>
                ) : null}
                {step.value}
              </p>
              <p className="ats-step-detail">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      {isLatestBuild && done && result.refinements.length ? (
        <div className="ats-chips" role="group" aria-label="Suggested changes">
          {result.refinements.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSend(result.canPublish ? r.label : `${r.label} template`)}
              disabled={busy}
            >
              {r.label}
            </button>
          ))}
          {result.canPublish ? (
            <button type="button" className="is-primary" onClick={() => onSend("Publish it for everyone")} disabled={busy}>
              Publish it for everyone
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function SupporterPreview({ pack }: { pack: DraftTemplatePack }) {
  const { goal, roster } = sampleGoalCents(pack);
  const raised = Math.round((goal * 0.38) / 100) * 100;
  const sport = pack.sportPreset.displayName;
  return (
    <div className="ats-sp" style={themeVars(pack)}>
      <p className="ats-sp-kicker">Lincoln {sport} · {pack.theme.name}</p>
      <h3 className="ats-sp-headline">
        {pack.theme.headlineVerb} Lincoln {sport}
      </h3>
      <p className="ats-sp-muted">{pack.theme.description}</p>
      <div
        className="ats-sp-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={38}
        aria-label={`${formatCents(raised)} raised of ${formatCents(goal)}`}
      >
        <span style={{ width: "38%" }} />
      </div>
      <p className="ats-sp-goal">
        <strong>{formatCents(raised)}</strong> of {formatCents(goal)} goal · {roster} players × {formatCents(pack.sportPreset.dollarsPerPlayerCents)}
      </p>
      <ul className="ats-sp-offers">
        {pack.catalogSkus.map((sku) => (
          <li key={sku.id}>
            <span className="ats-sp-name">{sku.name}</span>
            <span className="ats-sp-price">{formatCents(sku.retailCents)}</span>
            <span className="ats-sp-credit">{formatCents(sku.groupCreditCents)} to the team</span>
          </li>
        ))}
      </ul>
      <p className="ats-sp-fine">Shipping never counts toward the goal. Sample numbers, not live sales.</p>
    </div>
  );
}

function BriefPreview({ pack }: { pack: DraftTemplatePack }) {
  const { goal, roster } = sampleGoalCents(pack);
  const c = pack.theme.colors;
  return (
    <div className="ats-bp">
      <div className="ats-bp-field">
        <span className="ats-bp-label">Sport</span>
        <span className="ats-bp-select">
          {pack.sportPreset.displayName}
          <span className="ats-new">New</span>
        </span>
      </div>
      <div className="ats-bp-field">
        <span className="ats-bp-label">Theme</span>
        <span className="ats-bp-theme" style={{ background: c.background, color: c.ink }}>
          <span className="theme-swatch" aria-hidden="true">
            <i style={{ background: c.accent }} />
            <i style={{ background: c.backgroundAlt }} />
            <i style={{ background: c.ink }} />
          </span>
          <span>{pack.theme.name}</span>
          <span className="ats-new">New</span>
        </span>
      </div>
      <dl className="ats-bp-rules">
        <div>
          <dt>Goal rule</dt>
          <dd>{formatCents(pack.sportPreset.dollarsPerPlayerCents)} per player</dd>
        </div>
        <div>
          <dt>Limits</dt>
          <dd>{limitsLabel(pack)}</dd>
        </div>
        <div>
          <dt>Sample goal</dt>
          <dd>
            {formatCents(goal)} for {roster} players
          </dd>
        </div>
        <div>
          <dt>Offers</dt>
          <dd>{pack.catalogSkus.length} items + donations</dd>
        </div>
      </dl>
      <p className="ats-bp-note">Campaign managers pick this from the sport list. The rules fill the goal and the offers; they approve the words.</p>
    </div>
  );
}

function TokenPreview({ pack }: { pack: DraftTemplatePack }) {
  const c = pack.theme.colors;
  const rows: Array<{ name: string; hex: string; against?: string; againstName?: string }> = [
    { name: "Accent", hex: c.accent, against: c.background, againstName: "background" },
    { name: "Accent text", hex: c.accentInk, against: c.accent, againstName: "accent" },
    { name: "Ink", hex: c.ink, against: c.background, againstName: "background" },
    { name: "Muted", hex: c.muted, against: c.background, againstName: "background" },
    { name: "Background", hex: c.background },
    { name: "Panel", hex: c.panel },
  ];
  return (
    <ul className="ats-tokens">
      {rows.map((row) => {
        const ratio = row.against ? contrast(row.hex, row.against) : null;
        return (
          <li key={row.name}>
            <span className="ats-token-chip" style={{ background: row.hex }} aria-hidden="true" />
            <span className="ats-token-name">{row.name}</span>
            <code>{row.hex}</code>
            <span className="ats-token-ratio">
              {ratio != null ? `${ratio.toFixed(1)}:1 on ${row.againstName} · ${ratio >= 7 ? "AAA" : "below AAA"}` : "Surface"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
