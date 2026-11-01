import { useEffect, useMemo, useRef, useState } from "react";
import { type ChatAgent, type ChatSuggestion, createFaqAgent } from "../client/chat-agent.ts";
import { isLang, type Lang } from "../client/language.ts";

interface Message {
  role: "user" | "assistant";
  text: string;
  followUps?: ChatSuggestion[];
}

interface Strings {
  title: string;
  prototype: string;
  typing: string;
  suggested: string;
  yourQuestion: string;
  placeholder: string;
  ask: string;
  loadFailed: string;
  error: string;
}

const STRINGS: Record<Lang, Strings> = {
  en: {
    title: "Ask the tiger",
    prototype: "prototype",
    typing: "The tiger is typing…",
    suggested: "Suggested questions",
    yourQuestion: "Your question",
    placeholder: "Ask something…",
    ask: "Ask",
    loadFailed: "The tiger could not load its questions. Reload the page to try again.",
    error: "Sorry, something went wrong. Please try again.",
  },
  nl: {
    title: "Vraag het de tijger",
    prototype: "prototype",
    typing: "De tijger is aan het typen…",
    suggested: "Voorgestelde vragen",
    yourQuestion: "Jouw vraag",
    placeholder: "Vraag iets…",
    ask: "Vraag",
    loadFailed: "De tijger kon zijn vragen niet laden. Herlaad de pagina om het opnieuw te proberen.",
    error: "Sorry, er ging iets mis. Probeer het opnieuw.",
  },
  fr: {
    title: "Demande au tigre",
    prototype: "prototype",
    typing: "Le tigre est en train d'écrire…",
    suggested: "Questions suggérées",
    yourQuestion: "Ta question",
    placeholder: "Pose une question…",
    ask: "Demander",
    loadFailed: "Le tigre n'a pas pu charger ses questions. Recharge la page pour réessayer.",
    error: "Désolé, une erreur s'est produite. Réessaie.",
  },
  de: {
    title: "Frag den Tiger",
    prototype: "Prototyp",
    typing: "Der Tiger tippt…",
    suggested: "Vorgeschlagene Fragen",
    yourQuestion: "Deine Frage",
    placeholder: "Frag etwas…",
    ask: "Fragen",
    loadFailed: "Der Tiger konnte seine Fragen nicht laden. Lade die Seite neu, um es erneut zu versuchen.",
    error: "Entschuldigung, etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
};

const bubble = "w-fit max-w-[85%] rounded px-3 py-2 text-sm";
const pill =
  "rounded-full border border-stone-900 bg-amber-200 px-3 py-1 text-sm font-medium hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950";

/** The page language, which the language switch keeps on the `lang` attribute of `<html>`. */
function usePageLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const read = () => {
      const value = document.documentElement.lang;
      setLang(isLang(value) ? value : "en");
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);
  return lang;
}

/** The "somebody is typing" dots. The text is for screen readers; the dots are decoration. */
function TypingIndicator({ label }: { label: string }) {
  return (
    <p role="status" className={`${bubble} flex items-center gap-1 bg-white`}>
      <span className="sr-only">{label}</span>
      {[0, 150, 300].map((delay) => (
        <span key={delay} aria-hidden="true" style={{ animationDelay: `${delay}ms` }}
          className="h-2 w-2 rounded-full bg-stone-500 motion-safe:animate-bounce" />
      ))}
    </p>
  );
}

function ChatPanel({ chat, t, id }: { chat: ChatAgent; t: Strings; id: string }) {
  const [suggestions, setSuggestions] = useState<ChatSuggestion[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [asked, setAsked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current = true;
    chat.suggestions().then(
      (items) => current && setSuggestions(items),
      () => current && setLoadFailed(true),
    );
    return () => {
      current = false;
    };
  }, [chat]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, typing]);

  async function ask(text: string, { id, prompt, shown, completes }: { id?: string; prompt?: string; shown?: boolean; completes?: string } = {}) {
    const question = (prompt ?? text).trim();
    if (!question || busy) return;
    setBusy(true);
    setInput("");
    // A follow-up is used up when chosen; a suggestion only once all its answers have been given.
    if (completes) setAsked((a) => [...a, completes, ...(id ? [id] : [])]);
    setMessages((m) => [...m, { role: "user", text: shown ? text : question }]);
    try {
      for await (const event of chat.run(question)) {
        if (event.type === "run-started") setTyping(true);
        if (event.type === "text") {
          setTyping(false);
          if (id && !completes && !event.followUps) setAsked((a) => [...a, id]);
          setMessages((m) => [...m, { role: "assistant", text: event.text, followUps: event.followUps }]);
        }
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: t.error }]);
    } finally {
      setTyping(false);
      setBusy(false);
    }
  }

  return (
    <div id={id} className="mt-3">
      {loadFailed
        ? <p className="text-sm">{t.loadFailed}</p>
        : suggestions === null
        ? <TypingIndicator label={t.typing} />
        : (
          <ul aria-label={t.suggested} className="flex flex-wrap gap-2">
            {suggestions.filter((s) => !asked.includes(s.id)).map((s) => (
              <li key={s.id}>
                <button type="button" disabled={busy} onClick={() => ask(s.label, { id: s.id })} className={pill}>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      <div ref={log} role="log" aria-live="polite" className="mt-3 max-h-60 space-y-2 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className="space-y-1">
            <p className={m.role === "user" ? `${bubble} ml-auto bg-stone-900 text-white` : `${bubble} bg-white`}>
              {m.text}
            </p>
            {m.followUps?.filter((f) => !asked.includes(f.id)).map((f) => (
              <button key={f.id} type="button" disabled={busy} className={pill}
                onClick={() => ask(f.label, { id: f.id, prompt: f.prompt, shown: true, completes: f.completes })}>
                {f.label}
              </button>
            ))}
          </div>
        ))}
        {typing && <TypingIndicator label={t.typing} />}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <label htmlFor={`${id}-input`} className="sr-only">{t.yourQuestion}</label>
        <input id={`${id}-input`} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.placeholder}
          className="min-w-0 flex-1 rounded border border-stone-900 bg-white px-3 py-2 text-sm" />
        <button type="submit" disabled={busy} className="rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white">{t.ask}</button>
      </form>
    </div>
  );
}

/**
 * Collapsed until clicked. The FAQ is only fetched after the first opening, and the
 * conversation restarts when the page language changes, because the FAQ is per language.
 */
export default function Chatbot({ agent, faqBase = "chat/faq" }: { agent?: ChatAgent; faqBase?: string }) {
  const lang = usePageLang();
  const t = STRINGS[lang];
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const chat = useMemo(() => agent ?? createFaqAgent(`${faqBase}.${lang}.json`), [agent, faqBase, lang]);

  return (
    <section aria-labelledby="chat-title" className="mt-8 max-w-xl rounded border-2 border-stone-900 bg-amber-50 p-3">
      <h2 id="chat-title" className="text-base font-bold">
        <button type="button" aria-expanded={open} aria-controls="chat-panel" className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => { setOpen(!open); setEverOpened(true); }}>
          <span>
            {t.title} <span className="text-xs font-normal uppercase tracking-wide text-stone-600">({t.prototype})</span>
          </span>
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        </button>
      </h2>
      {everOpened && (
        <div hidden={!open}>
          <ChatPanel key={lang} chat={chat} t={t} id="chat-panel" />
        </div>
      )}
    </section>
  );
}
