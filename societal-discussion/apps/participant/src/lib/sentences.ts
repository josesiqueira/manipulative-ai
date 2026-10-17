// Split a reply into sentences for sentence-by-sentence speech. Long sentences
// are cut at commas so no request exceeds the server's text cap.
export function splitSentences(text: string, maxLength = 280): string[] {
  const out: string[] = [];
  const parts = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…])\s+(?=\S)/u)
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
