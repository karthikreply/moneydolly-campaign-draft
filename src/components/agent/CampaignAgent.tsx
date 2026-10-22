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
import { useOperator } from "../OperatorProvider";

type Message = { id: string; role: "agent" | "user"; text: string };

type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: (() => void) | null;
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
  rec.interimResults = false;
  rec.continuous = false;
  return rec;
}

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
  const [speak, setSpeak] = useState(true);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [published, setPublished] = useState<{ campaign: PublishedCampaign; roster: Participant[] } | null>(null);

  const recognizer = useRef<SpeechRec | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const speakRef = useRef(speak);
  speakRef.current = speak;

  const say = useCallback(
    (text: string) => {
      if (!speakRef.current || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = operator.assistant.voice.rate;
      utterance.pitch = operator.assistant.voice.pitch;
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    },
    [operator.assistant.voice.pitch, operator.assistant.voice.rate],
  );

  const pushAgent = useCallback(
    (result: AgentStepResult) => {
      setMessages((prev) => [...prev, { id: uid(), role: "agent", text: result.reply }]);
      setSuggestions(result.suggestions);
      setState(result.state);
      say(result.reply);
    },
    [say],
  );

  // Greet on mount and whenever the vendor changes: the agent re-introduces itself in the new brand.
  useEffect(() => {
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
    recognizer.current?.stop();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
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
        const res = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.brief),
        });
        const data = (await res.json()) as CampaignDraft & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not create the draft");
        setDraft(data);
        pushAgent(draftReadyReply(result.state, data));
      } else if (action.type === "publish") {
        const res = await fetch(`/api/drafts/${action.draftId}/publish`, { method: "POST" });
        const data = (await res.json()) as {
          draft: CampaignDraft;
          campaign: PublishedCampaign;
          roster: Participant[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Publish failed");
        setPublished({ campaign: data.campaign, roster: data.roster ?? [] });
        pushAgent(publishedReply(result.state, data.campaign, data.roster?.length ?? 0));
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "Something went wrong";
      pushAgent({ state: result.state, reply: `${text}. Try again, or say start over.`, suggestions: ["Start over"] });
    } finally {
      setBusy(false);
    }
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((prev) => [...prev, { id: uid(), role: "user", text }]);
    const result = agentStep(state, text, persona);
    pushAgent(result);
    await runAction(result);
    inputRef.current?.focus();
  }

  function toggleMic() {
    const rec = recognizer.current ?? createRecognizer();
    if (!rec) {
      setMicNote("This browser has no speech input. Type your answer instead.");
      inputRef.current?.focus();
      return;
    }
    recognizer.current = rec;
    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) void send(transcript);
    };
    rec.onerror = () => {
      setListening(false);
      setMicNote("Didn't catch that. Tap the mic again or type.");
    };
    rec.onend = () => setListening(false);
    setMicNote(null);
    setListening(true);
    rec.start();
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
        <label className="agent-toggle">
          <input type="checkbox" checked={speak} onChange={(e) => setSpeak(e.target.checked)} />
          Read replies aloud
        </label>
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
                <dd>{draftSkus.map((sku) => sku.name).join(", ")}</dd>
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
          className={`agent-mic${listening ? " is-listening" : ""}`}
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : "Push to talk"}
          onClick={toggleMic}
          disabled={busy}
        >
          {listening ? "Listening…" : "Talk"}
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
