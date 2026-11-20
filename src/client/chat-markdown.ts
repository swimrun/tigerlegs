/**
 * The small part of Markdown that a chat message may use: `code`, **bold**, *italic* and [text](address).
 * Nothing becomes HTML: the parser only says what each piece is, and the component builds elements from it, so
 * a `<script>` in a message is shown as text. A link is only kept when its address is http(s) or a path on this
 * site; any other address (javascript:, data:, …) is shown as plain text.
 */
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "link"; text: string; href: string };

const TOKEN = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

export const isSafeHref = (href: string) => /^https?:\/\//i.test(href) || /^(\/(?!\/)|\.\/|\.\.\/|#)/.test(href);

export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let from = 0;
  const plain = (to: number) => {
    if (to > from) parts.push({ kind: "text", text: text.slice(from, to) });
  };
  for (const match of text.matchAll(TOKEN)) {
    const [whole, code, strong, em, label, href] = match;
    const start = match.index;
    if (label !== undefined && !isSafeHref(href)) continue;
    plain(start);
    if (code !== undefined) parts.push({ kind: "code", text: code });
    else if (strong !== undefined) parts.push({ kind: "strong", text: strong });
    else if (em !== undefined) parts.push({ kind: "em", text: em });
    else parts.push({ kind: "link", text: label, href });
    from = start + whole.length;
  }
  plain(text.length);
  return parts;
}
