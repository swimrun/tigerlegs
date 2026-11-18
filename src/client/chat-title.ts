/**
 * The name of the bot and what it stands for, from a title such as "ROARRS: Robotic Operating Agent that Responds to
 * Requests about Swimrun". The chat window shows the name large and the expansion small beneath it, so that the
 * title takes one or two lines; a title without a colon is all name.
 */
export function splitChatTitle(title: string): { name: string; expansion: string } {
  const at = title.indexOf(": ");
  return at > 0 ? { name: title.slice(0, at), expansion: title.slice(at + 2) } : { name: title, expansion: "" };
}
