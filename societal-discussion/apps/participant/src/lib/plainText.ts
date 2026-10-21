// The model sometimes answers in Markdown (bold, italics, headings, lists).
// The bubbles show plain text and the voice must never read the markers, so
// every reply goes through toPlainText once: the same text is shown, lit up
// word by word and split into the sentences that are spoken. List items keep
// their own line and start with a bullet, which is never spoken.
export const BULLET = '•';

export function toPlainText(markdown: string): string {
  const lines = markdown
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) return ''; // a rule line
      return line
        .replace(/^\s{0,3}#{1,6}\s+/, '') // heading
        .replace(/^\s*>\s?/, '') // quote
        .replace(/^\s*[-*+•]\s+/, `${BULLET} `); // list item
    });
  return lines
    .join('\n')
    .replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, '$1') // link: keep its text
    .replace(/`+([^`\n]*)`+/g, '$1') // code
    .replace(/(\*\*|__)(?=\S)([^\n]*?\S)\1/g, '$2') // bold
    .replace(/(^|[\s(])_(?=\S)([^_\n]*?\S)_(?=[\s.,;:!?)]|$)/gm, '$1$2') // _italics_
    .replace(/\*+/g, '') // *italics* and any stray asterisk
    .replace(/ {2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
