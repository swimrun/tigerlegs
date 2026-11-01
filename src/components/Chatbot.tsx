import { useMemo, useState } from "react";
import { type ChatAgent, createFaqAgent } from "../client/chat-agent.ts";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function Chatbot({ agent }: { agent?: ChatAgent }) {
  const chat = useMemo(() => agent ?? createFaqAgent(), [agent]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    for await (const event of chat.run(question)) {
      if (event.type === "text") setMessages((m) => [...m, { role: "assistant", text: event.text }]);
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="chat-title" className="mt-8 rounded border-2 border-stone-900 bg-amber-50 p-4">
      <h2 id="chat-title" className="text-lg font-bold">Ask the tiger <span className="text-xs font-normal uppercase tracking-wide text-stone-600">(prototype)</span></h2>
      <ul aria-label="Suggested questions" className="mt-3 flex flex-wrap gap-2">
        {chat.suggestions().map((s) => (
          <li key={s.id}>
            <button type="button" disabled={busy} onClick={() => ask(s.label)}
              className="rounded-full border border-stone-900 bg-amber-200 px-3 py-1 text-sm font-medium hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950">
              {s.label}
            </button>
          </li>
        ))}
      </ul>
      <div role="log" aria-live="polite" className="mt-3 space-y-2">
        {messages.map((m, i) => (
          <p key={i} className={m.role === "user" ? "ml-auto w-fit max-w-[85%] rounded bg-stone-900 px-3 py-2 text-sm text-white" : "w-fit max-w-[85%] rounded bg-white px-3 py-2 text-sm"}>
            {m.text}
          </p>
        ))}
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
