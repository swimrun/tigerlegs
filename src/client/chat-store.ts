import type { ChatAgent } from "./chat-agent.ts";

/**
 * What the current page wants the shared chat to be. The chat lives in the site layout and survives
 * page navigation, so a page registers its agent while it is shown and withdraws it when it goes.
 * Islands on one page share this module, which is why a plain store is enough.
 */
export interface PageChat {
  agent: ChatAgent;
  title?: string;
  placeholder?: string;
}

let current: PageChat | null = null;
const listeners = new Set<() => void>();

export const getPageChat = (): PageChat | null => current;

export function setPageChat(next: PageChat | null): void {
  current = next;
  listeners.forEach((listener) => listener());
}

export function subscribePageChat(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
