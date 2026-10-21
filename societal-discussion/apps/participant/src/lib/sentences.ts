import { BULLET } from './plainText';

// Split a reply (already plain text, see plainText.ts) into sentences for
// sentence-by-sentence speech. A line break ends a sentence too, since list
// items and headings often have no full stop; the list bullet is not spoken.
// Long sentences are cut at commas so no request exceeds the server's text cap.
export function splitSentences(text: string, maxLength = 280): string[] {
  const out: string[] = [];
  const parts = text
    .split(/\n+/)
    .map((line) => line.replace(new RegExp(`^\\s*${BULLET}\\s*`), '').replace(/\s+/g, ' ').trim())
    // No cut after a number with a full stop ("1. Ensin", "23. lokakuuta").
    .flatMap((line) => line.split(/(?<=[!?…]|(?<!\d)\.)\s+(?=\S)/u))
    .filter((p) => p.length > 0);
  for (const part of parts) {
    if (part.length <= maxLength) {
      out.push(part);
      continue;
    }
    let rest = part;
    while (rest.length > maxLength) {
      const cut = rest.lastIndexOf(', ', maxLength);
      const at = cut > 40 ? cut + 1 : maxLength;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}
