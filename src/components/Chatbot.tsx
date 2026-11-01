import { useEffect, useMemo, useRef, useState } from "react";
import { type ChatAgent, type ChatSuggestion, createFaqAgent } from "../client/chat-agent.ts";

interface Message {
  role: "user" | "assistant";
  text: string;
  followUps?: ChatSuggestion[];
}

const bubble = "w-fit max-w-[85%] rounded px-3 py-2 text-sm";

/** The "somebody is typing" dots. The text is for screen readers; the dots are decoration. */
function TypingIndicator() {
  return (
    <p role="status" className={`${bubble} flex items-center gap-1 bg-white`}>
      <span className="sr-only">The tiger is typing…</span>
      {[0, 150, 300].map((delay) => (
        <span key={delay} aria-hidden="true" style={{ animationDelay: `${delay}ms` }}
          className="h-2 w-2 rounded-full bg-stone-500 motion-safe:animate-bounce" />
      ))}
    </p>
  );
}

export default function Chatbot({ agent, faqUrl = "chat/faq.json" }: { agent?: ChatAgent; faqUrl?: string }) {
  const chat = useMemo(() => agent ?? createFaqAgent(faqUrl), [agent, faqUrl]);
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
      setMessages((m) => [...m, { role: "assistant", text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setTyping(false);
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="chat-title" className="mt-8 rounded border-2 border-stone-900 bg-amber-50 p-4">
      <h2 id="chat-title" className="text-lg font-bold">Ask the tiger <span className="text-xs font-normal uppercase tracking-wide text-stone-600">(prototype)</span></h2>
      {loadFailed
        ? <p className="mt-3 text-sm">The tiger could not load its questions. Reload the page to try again.</p>
        : suggestions === null
        ? <div className="mt-3"><TypingIndicator /></div>
        : (
          <ul aria-label="Suggested questions" className="mt-3 flex flex-wrap gap-2">
            {suggestions.filter((s) => !asked.includes(s.id)).map((s) => (
              <li key={s.id}>
                <button type="button" disabled={busy} onClick={() => ask(s.label, { id: s.id })}
                  className="rounded-full border border-stone-900 bg-amber-200 px-3 py-1 text-sm font-medium hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950">
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      <div ref={log} role="log" aria-live="polite" className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className="space-y-1">
            <p className={m.role === "user" ? `${bubble} ml-auto bg-stone-900 text-white` : `${bubble} bg-white`}>
              {m.text}
            </p>
            {m.followUps?.filter((f) => !asked.includes(f.id)).map((f) => (
              <button key={f.id} type="button" disabled={busy}
                onClick={() => ask(f.label, { id: f.id, prompt: f.prompt, shown: true, completes: f.completes })}
                className="rounded-full border border-stone-900 bg-amber-200 px-3 py-1 text-sm font-medium hover:bg-amber-300">
                {f.label}
              </button>
            ))}
          </div>
        ))}
        {typing && <TypingIndicator />}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <label htmlFor="chat-input" className="sr-only">Your question</label>
        <input id="chat-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask something…"
          className="min-w-0 flex-1 rounded border border-stone-900 bg-white px-3 py-2 text-sm" />
        <button type="submit" disabled={busy} className="rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white">Ask</button>
      </form>
    </section>
  );
}
