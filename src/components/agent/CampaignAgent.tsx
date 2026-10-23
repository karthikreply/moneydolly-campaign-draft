"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  agentStep,
  draftReadyReply,
  greeting,
  initialAgentState,
  publishedReply,
  type AgentDialogState,
  type AgentStepResult,
} from "@/domain/agent/campaign-agent-dialog";
import { formatCents } from "@/domain/campaign-draft/fee-preview";
import type { CampaignDraft, CatalogSku, Participant, PublishedCampaign } from "@/domain/campaign-draft/types";
import { apiCreateDraft, apiPublishDraft } from "@/lib/campaign-client";
import { useOperator } from "../OperatorProvider";

type Message = { id: string; role: "agent" | "user"; text: string };

type SpeechAlt = { transcript: string };
type SpeechResult = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<SpeechAlt> & { isFinal: boolean }>;
};
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function createRecognizer(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = true;
  return rec;
}

const LISTENING_NOTE =
  "Listening. Speak, then pause. I answer and keep listening — press Stop when you're done.";
const ANSWERING_NOTE = "Answering. I'll listen again when I finish. Press Stop to end.";

function uid(): string {
  return globalThis.crypto.randomUUID();
}

export function CampaignAgent({ catalog }: { catalog: CatalogSku[] }) {
  const router = useRouter();
  const { operator } = useOperator();
  const persona = { name: operator.assistant.name, operatorName: operator.operatorName };

  const [state, setState] = useState<AgentDialogState>(initialAgentState);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [sessionOn, setSessionOn] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [published, setPublished] = useState<{ campaign: PublishedCampaign; roster: Participant[] } | null>(null);

  const recognizer = useRef<SpeechRec | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const engagedRef = useRef(false);
  const holdRef = useRef(false);
  const busyRef = useRef(false);
  const resumeRef = useRef<() => void>(() => {});
  const sendRef = useRef<(raw: string) => void>(() => {});
  const utteranceRef = useRef("");
  const silenceRef = useRef<number | null>(null);
  const onSpeechRef = useRef<(event: SpeechResult) => void>(() => {});
  busyRef.current = busy;

  const pushAgent = useCallback((result: AgentStepResult) => {
    setMessages((prev) => [...prev, { id: uid(), role: "agent", text: result.reply }]);
    setSuggestions(result.suggestions);
    setState(result.state);
    return Promise.resolve();
  }, []);

  // Greet on mount and whenever the vendor changes: the agent re-introduces itself in the new brand.
  useEffect(() => {
    engagedRef.current = false;
    holdRef.current = false;
    try {
      recognizer.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
    setSessionOn(false);
    setMicNote(null);
    const hello = greeting(persona, operator.assistant.greeting);
    setMessages([{ id: uid(), role: "agent", text: hello.reply }]);
    setSuggestions(hello.suggestions);
    setState(hello.state);
    setDraft(null);
    setPublished(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operator.id]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => () => {
    engagedRef.current = false;
    try {
      recognizer.current?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  async function runAction(result: AgentStepResult) {
    const action = result.action;
    if (!action) return;
    if (action.type === "restart") {
      setDraft(null);
      setPublished(null);
      return;
    }
    if (action.type === "open_studio") {
      router.push(`/drafts/${action.draftId}`);
      return;
    }
    setBusy(true);
    try {
      if (action.type === "create_draft") {
        const data = await apiCreateDraft(action.brief);
        setDraft(data);
        await pushAgent(draftReadyReply(result.state, data));
      } else if (action.type === "publish") {
        const data = await apiPublishDraft(action.draftId);
        setPublished({ campaign: data.campaign, roster: data.roster ?? [] });
        await pushAgent(publishedReply(result.state, data.campaign, data.roster?.length ?? 0));
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "Something went wrong";
      await pushAgent({ state: result.state, reply: `${text}. Try again, or say start over.`, suggestions: ["Start over"] });
    } finally {
      setBusy(false);
    }
  }

  function clearSilence() {
    if (silenceRef.current !== null) {
      window.clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
  }

  function commitHeard() {
    clearSilence();
    const heard = utteranceRef.current.trim();
    utteranceRef.current = "";
    if (!heard || holdRef.current || !engagedRef.current) return;
    holdRef.current = true;
    setInput("");
    setListening(false);
    setMicNote(ANSWERING_NOTE);
    try {
      recognizer.current?.stop();
    } catch {
      /* already stopped */
    }
    sendRef.current(heard);
  }

  function endSession() {
    engagedRef.current = false;
    holdRef.current = false;
    utteranceRef.current = "";
    clearSilence();
    setSessionOn(false);
    setListening(false);
    setMicNote(null);
    try {
      recognizer.current?.stop();
    } catch {
      /* already stopped */
    }
  }

  function resumeListening() {
    if (!engagedRef.current || holdRef.current) return;
    const rec = ensureRecognizer();
    if (!rec) return;
    try {
      rec.start();
    } catch {
      /* already running */
    }
    setListening(true);
    setMicNote(LISTENING_NOTE);
  }
  resumeRef.current = resumeListening;

  function ensureRecognizer(): SpeechRec | null {
    if (recognizer.current) return recognizer.current;
    const rec = createRecognizer();
    if (!rec) {
      setMicNote("This browser has no speech input. Type your answer instead.");
      inputRef.current?.focus();
      return null;
    }
    rec.onresult = (event) => onSpeechRef.current(event);
    rec.onerror = (event) => {
      const code = event.error ?? "";
      if (code === "aborted" || code === "no-speech") return;
      engagedRef.current = false;
      holdRef.current = false;
      setSessionOn(false);
      setListening(false);
      setMicNote(
        code === "not-allowed"
          ? "Allow the microphone for this site, or type your answer."
          : "I couldn't use the microphone. Type your answer instead.",
      );
      inputRef.current?.focus();
    };
    rec.onend = () => {
      setListening(false);
      window.setTimeout(() => resumeRef.current(), 300);
    };
    recognizer.current = rec;
    return rec;
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busyRef.current) return;
    const keepListening = engagedRef.current;
    if (keepListening) {
      holdRef.current = true;
      setListening(false);
      setMicNote(ANSWERING_NOTE);
      try {
        recognizer.current?.stop();
      } catch {
        /* already stopped */
      }
    }
    setInput("");
    setMessages((prev) => [...prev, { id: uid(), role: "user", text }]);
    const result = agentStep(state, text, persona);
    const spoken = pushAgent(result);
    await runAction(result);
    await spoken;
    if (keepListening) {
      holdRef.current = false;
      if (engagedRef.current) resumeListening();
    }
    inputRef.current?.focus();
  }
  sendRef.current = (raw) => {
    void send(raw);
  };
  onSpeechRef.current = (event) => {
    if (holdRef.current || busyRef.current || !engagedRef.current) return;
    let finalText = "";
    let interim = "";
    for (let i = 0; i < event.results.length; i += 1) {
      const chunk = event.results[i]?.[0]?.transcript ?? "";
      if (event.results[i]?.isFinal) finalText += chunk;
      else interim += chunk;
    }
    const live = `${finalText} ${interim}`.trim();
    if (!live) return;
    utteranceRef.current = live;
    setInput(live);
    clearSilence();
    silenceRef.current = window.setTimeout(() => commitHeard(), 1300);
  };

  function toggleMic() {
    if (engagedRef.current) {
      endSession();
      return;
    }
    const rec = ensureRecognizer();
    if (!rec) return;
    engagedRef.current = true;
    holdRef.current = false;
    setSessionOn(true);
    try {
      rec.start();
    } catch {
      /* already running */
    }
    setListening(true);
    setMicNote(LISTENING_NOTE);
  }

  const draftSkus = draft ? catalog.filter((sku) => draft.skuIds.includes(sku.id)) : [];

  return (
    <section
      className="agent-shell"
      aria-label={`${persona.name}, the ${operator.operatorName} campaign assistant`}
    >
      <header className="agent-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={operator.logoUrl} alt="" width={44} height={44} className="agent-avatar" />
        <div>
          <h1 className="agent-title">{persona.name}</h1>
          <p className="agent-subtitle">{operator.operatorName} campaign assistant</p>
        </div>
      </header>

      <div className="agent-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions">
        {messages.map((message) => (
          <div key={message.id} className={`agent-msg agent-msg-${message.role}`}>
            <span className="agent-msg-who">{message.role === "agent" ? persona.name : "You"}</span>
            <p>{message.text}</p>
          </div>
        ))}

        {draft ? (
          <div className="agent-card" aria-label="Draft summary">
            <h2>{draft.headline}</h2>
            <p>{draft.supportingLine}</p>
            <dl className="agent-card-facts">
              <div>
                <dt>Goal</dt>
                <dd className="money">{formatCents(draft.goalCents)}</dd>
              </div>
              <div>
                <dt>Roster</dt>
                <dd>{draft.brief.rosterSize} players</dd>
              </div>
              <div>
                <dt>Window</dt>
                <dd>
                  {draft.brief.windowStart} → {draft.brief.windowEnd}
                </dd>
              </div>
              <div>
                <dt>Offers</dt>
                <dd>
                  {draftSkus.length <= 3
                    ? draftSkus.map((sku) => sku.name).join(", ")
                    : `${draftSkus
                        .slice(0, 3)
                        .map((sku) => sku.name)
                        .join(", ")} +${draftSkus.length - 3} more`}
                </dd>
              </div>
            </dl>
            <p className="agent-card-why">{draft.whyDraft}</p>
            {published ? (
              <div className="agent-links">
                <strong>Live links</strong>
                <a href={`/c/${published.campaign.slug}?op=${operator.id}`} target="_blank" rel="noreferrer">
                  Team page /c/{published.campaign.slug}
                </a>
                {published.roster.map((player) => (
                  <a
                    key={player.id}
                    href={`/c/${published.campaign.slug}/${player.slug}?op=${operator.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {player.displayName}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {busy ? (
          <p className="agent-busy" role="status">
            {persona.name} is working…
          </p>
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <div className="agent-suggestions" aria-label="Quick replies">
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => void send(suggestion)} disabled={busy}>
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="agent-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <button
          type="button"
          className={`agent-mic${listening ? " is-listening" : ""}${sessionOn && !listening ? " is-holding" : ""}`}
          aria-pressed={sessionOn}
          aria-label={
            sessionOn
              ? "Stop the conversation"
              : "Start talking. I keep listening until you press Stop."
          }
          onClick={toggleMic}
          disabled={busy && !sessionOn}
        >
          {sessionOn ? (listening ? "Listening…" : "Stop") : "Talk"}
        </button>
        <input
          ref={inputRef}
          aria-label={`Message ${persona.name}`}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type or talk…"
          disabled={busy}
          autoComplete="off"
        />
        <button type="submit" className="agent-send" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
      {micNote ? (
        <p className="muted" role="status">
          {micNote}
        </p>
      ) : null}
    </section>
  );
}
