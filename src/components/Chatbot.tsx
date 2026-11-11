import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { type ChatAgent, type ChatSuggestion, createFaqAgent } from "../client/chat-agent.ts";
import { getPageChat, subscribePageChat } from "../client/chat-store.ts";
import { freeformHint, isChromeBrowser, isNanoLanguage } from "../client/chat-hints.ts";
import { isLang, type Lang } from "../client/language.ts";
import { type ChatStrings, STRINGS } from "../client/chat.strings.ts";

interface Message {
  role: "user" | "assistant";
  text: string;
  followUps?: ChatSuggestion[];
}

const bubble = "w-fit max-w-[85%] rounded px-3 py-2 text-sm";

/**
 * A chat message as text, with two line conventions an agent can use: "# Heading" is a bold heading and
 * consecutive "- item" lines are a bulleted list. Every other line is a paragraph; a message without
 * either convention renders as the single paragraph it always was.
 */
export function ChatText({ text, className }: { text: string; className: string }) {
  const blocks: ({ kind: "p" | "h"; text: string } | { kind: "ul"; items: string[] })[] = [];
  for (const line of text.split("\n")) {
    const last = blocks.at(-1);
    if (line.startsWith("- ")) {
      if (last?.kind === "ul") last.items.push(line.slice(2));
      else blocks.push({ kind: "ul", items: [line.slice(2)] });
    } else if (line.startsWith("# ")) {
      blocks.push({ kind: "h", text: line.slice(2) });
    } else {
      blocks.push({ kind: "p", text: line });
    }
  }
  if (blocks.length === 1 && blocks[0].kind === "p") return <p className={className}>{text}</p>;
  return (
    <div className={`${className} space-y-1`}>
      {blocks.map((block, index) =>
        block.kind === "ul"
          ? <ul key={index} className="list-disc space-y-1 pl-5">{block.items.map((item, at) => <li key={at}>{item}</li>)}</ul>
          : <p key={index} className={block.kind === "h" ? "font-semibold" : undefined}>{block.text}</p>
      )}
    </div>
  );
}

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

/** The "somebody is typing" dots. The label is for screen readers, unless a visible status text replaces it. */
function TypingIndicator({ label, status }: { label: string; status?: string | null }) {
  return (
    <p role="status" className={`${bubble} flex items-center gap-1 bg-white`}>
      <span className={status ? "mr-1" : "sr-only"}>{status ?? label}</span>
      {[0, 150, 300].map((delay) => (
        <span key={delay} aria-hidden="true" style={{ animationDelay: `${delay}ms` }}
          className="h-2 w-2 rounded-full bg-stone-500 motion-safe:animate-bounce" />
      ))}
    </p>
  );
}

function ChatPanel({ chat, t, id, placeholder }: { chat: ChatAgent; t: ChatStrings; id: string; placeholder: string }) {
  const [suggestions, setSuggestions] = useState<ChatSuggestion[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [asked, setAsked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
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

  // Chips of an earlier agent (e.g. "Apply proposal" from another page) mean nothing to this one.
  useEffect(() => {
    setMessages((m) => m.some((x) => x.followUps) ? m.map(({ followUps: _, ...rest }) => rest) : m);
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
        if (event.type === "status") setStatus(event.text);
        if (event.type === "text") {
          setTyping(false);
          setStatus(null);
          if (id && !completes && !event.followUps) setAsked((a) => [...a, id]);
          setMessages((m) => [...m, { role: "assistant", text: event.text, followUps: event.followUps }]);
        }
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: t.error }]);
    } finally {
      setTyping(false);
      setStatus(null);
      setBusy(false);
    }
  }

  return (
    <div id={id} className="mt-3">
      {loadFailed
        ? <p className="text-sm">{t.loadFailed}</p>
        : suggestions === null
        ? <TypingIndicator label={t.typing} />
        : suggestions.length === 0
        ? null
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
      <div ref={log} role="log" aria-live="polite" tabIndex={0} className="mt-3 max-h-60 space-y-2 overflow-y-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
        {messages.map((m, i) => (
          <div key={i} className="space-y-1">
            <ChatText text={m.text} className={m.role === "user" ? `${bubble} ml-auto bg-stone-900 text-white` : `${bubble} bg-white`} />
            {i === messages.length - 1 && m.followUps?.filter((f) => !asked.includes(f.id)).map((f) => (
              <button key={f.id} type="button" disabled={busy} className={pill}
                onClick={() => ask(f.label, { id: f.id, prompt: f.prompt, shown: true, completes: f.completes })}>
                {f.label}
              </button>
            ))}
          </div>
        ))}
        {typing && <TypingIndicator label={t.typing} status={status} />}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <label htmlFor={`${id}-input`} className="sr-only">{t.yourQuestion}</label>
        <input id={`${id}-input`} value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder}
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
export default function Chatbot(
  { agent, faqBase = "chat/faq", title, placeholder, defaultOpen = false }: {
    /** Answers the questions; defaults to the FAQ agent. The look and feel is the same for every agent. */
    agent?: ChatAgent;
    faqBase?: string;
    title?: string;
    placeholder?: string;
    defaultOpen?: boolean;
  },
) {
  const lang = usePageLang();
  const t = STRINGS[lang];
  const [open, setOpen] = useState(defaultOpen);
  const [everOpened, setEverOpened] = useState(defaultOpen);
  const pageChat = useSyncExternalStore(subscribePageChat, getPageChat, () => null);
  const chat = useMemo(() => {
    if (agent) return agent;
    if (pageChat) return pageChat.agent;
    // The FAQ is static, but free questions are meant for Gemini Nano: where it cannot work, say why.
    const hint = isNanoLanguage(lang) ? undefined : freeformHint(lang, isChromeBrowser());
    return createFaqAgent(`${faqBase}.${lang}.json`, { fallback: hint });
  }, [agent, pageChat, faqBase, lang]);

  return (
    <section aria-labelledby="chat-title" className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded border-2 border-stone-900 bg-amber-50 p-3 shadow-lg">
      <h2 id="chat-title" className="text-base font-bold">
        <button type="button" aria-expanded={open} aria-controls="chat-panel" className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => { setOpen(!open); setEverOpened(true); }}>
          <span>
            {title ?? pageChat?.title ?? t.title} <span className="text-xs font-normal uppercase tracking-wide text-stone-600">({t.prototype})</span>
          </span>
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        </button>
      </h2>
      {everOpened && (
        <div hidden={!open}>
          <ChatPanel key={lang} chat={chat} t={t} id="chat-panel" placeholder={placeholder ?? pageChat?.placeholder ?? t.placeholder} />
        </div>
      )}
    </section>
  );
}
