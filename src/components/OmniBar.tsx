"use client";

import { useEffect, useRef, useState } from "react";
import { apiIntakeUtterance } from "@/lib/campaign-client";
import { hydrateIntent } from "@/lib/hydrateIntent";
import type { ExtractedSlots } from "@/domain/campaign-draft/slot-extractor";

type SpeechResult = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

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
  rec.interimResults = true;
  rec.continuous = false;
  return rec;
}

export function OmniBar({
  busy,
  onDrafted,
  onPartial,
}: {
  busy?: boolean;
  onDrafted: (draftId: string) => void;
  onPartial: (slots: ExtractedSlots, missingSlots: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [speechNote, setSpeechNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognizer = useRef<SpeechRec | null>(null);
  const intent = text.trim() ? hydrateIntent(text) : null;

  useEffect(() => {
    return () => recognizer.current?.stop();
  }, []);

  function applyTranscript(transcript: string) {
    setText(transcript);
    const next = hydrateIntent(transcript);
    if (!next.canDraft) onPartial(next.extractedSlots, next.missingSlots);
  }

  function toggleSpeech() {
    const existing = recognizer.current ?? createRecognizer();
    if (!existing) {
      setSpeechNote("Microphone is unavailable. Type the brief instead.");
      inputRef.current?.focus();
      return;
    }
    recognizer.current = existing;
    if (listening) {
      existing.stop();
      setListening(false);
      return;
    }
    existing.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i]?.[0]?.transcript ?? "";
        if (event.results[i]?.isFinal) finalText += chunk;
        else interim += chunk;
      }
      if (interim.trim()) setText(interim);
      if (finalText.trim()) applyTranscript(finalText.trim());
    };
    existing.onerror = () => {
      setListening(false);
      setSpeechNote("Could not hear that. Type the brief instead.");
      inputRef.current?.focus();
    };
    existing.onend = () => setListening(false);
    setSpeechNote("Listening for one sentence. I stop when you pause. Click Talk to cancel.");
    setListening(true);
    existing.start();
  }

  async function submit() {
    const utterance = text.trim();
    if (!utterance) return;
    const next = hydrateIntent(utterance);
    if (!next.canDraft) {
      onPartial(next.extractedSlots, next.missingSlots);
      return;
    }
    setError(null);
    let data: Awaited<ReturnType<typeof apiIntakeUtterance>>;
    try {
      data = await apiIntakeUtterance(utterance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft that brief");
      return;
    }
    if (data.canDraft && data.draft?.id) {
      onDrafted(data.draft.id);
      return;
    }
    onPartial(data.extractedSlots ?? next.extractedSlots, data.missingSlots ?? next.missingSlots);
  }

  return (
    <div className="omni-shell">
      <div className="omni-bar">
        <button
          className="omni-mic"
          type="button"
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : "Dictate one sentence"}
          disabled={busy}
          onClick={toggleSpeech}
        >
          {listening ? "Listening…" : "Talk"}
        </button>
        <input
          ref={inputRef}
          id="omni"
          aria-label="One-line campaign brief"
          value={text}
          placeholder="Say it once: “Lincoln volleyball, 18 players, March 1 to April 15, spirit week”"
          onChange={(event) => {
            const value = event.target.value;
            setText(value);
            if (value.trim()) void hydrateIntent(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          disabled={busy}
        />
        <button
          className="omni-go"
          type="button"
          disabled={busy || text.trim().length === 0}
          onClick={() => void submit()}
        >
          {busy ? "Drafting…" : "Build draft"}
        </button>
      </div>
      {intent ? (
        <span className="omni-status" role="status">
          {intent.statusLabel}
        </span>
      ) : null}
      {speechNote ? <p className="muted">{speechNote}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
