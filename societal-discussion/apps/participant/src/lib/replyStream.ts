// A streamed reply: the server sends the reply in pieces while the model
// writes it (server-sent events over a POST), so the text appears within
// seconds and the avatar can speak the first sentence while the rest is
// still being written.
import { API_URL, type AssistantMessage, type InputMode } from './participantApi';
import { splitSentences } from './sentences';
import { toPlainText } from './plainText';

// Error codes as sendMessage: 'conversation-closed', 'too-many-messages',
// 'message-failed'.
export async function streamMessage(
  conversationId: string,
  content: string,
  inputMode: InputMode,
  onDelta: (text: string) => void,
): Promise<AssistantMessage> {
  const res = await fetch(`${API_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ content, input_mode: inputMode }),
  });
  if (res.status === 400 || res.status === 403 || res.status === 404) throw new Error('conversation-closed');
  if (res.status === 429) throw new Error('too-many-messages');
  if (!res.ok || !res.body) throw new Error('message-failed');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    // Events end with a blank line; comment lines (": ping") keep the
    // connection open while the model reads the party programme.
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let name = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) name = line.slice(7);
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (!data) continue;
      const payload = JSON.parse(data);
      if (name === 'delta') onDelta(payload.text as string);
      else if (name === 'done') {
        void reader.cancel().catch(() => undefined);
        return { id: payload.id, role: 'assistant', content: payload.content, created_at: payload.created_at };
      } else if (name === 'error') throw new Error('message-failed');
    }
    if (done) throw new Error('message-failed');
  }
}

// Turns the growing reply into whole sentences for speech, as soon as each
// one is complete. The last, unfinished sentence stays until more text
// arrives or the reply ends (flush).
export class SentenceFeeder {
  private raw = '';
  private taken = 0; // characters of the plain text already handed out

  constructor(private readonly onSentence: (sentence: string) => void) {}

  push(piece: string): void {
    this.raw += piece;
    const plain = toPlainText(this.raw);
    // A sentence is complete when its end mark or line break is followed by
    // more text; what follows the last such boundary may still grow.
    const re = /(?:[!?…]|(?<!\d)\.)\s+(?=\S)|\n+(?=\S)/gu;
    let boundary = -1;
    for (let m = re.exec(plain); m; m = re.exec(plain)) boundary = m.index + m[0].length;
    if (boundary > this.taken) {
      this.emit(plain.slice(this.taken, boundary));
      this.taken = boundary;
    }
  }

  flush(): void {
    const plain = toPlainText(this.raw);
    if (plain.length > this.taken) this.emit(plain.slice(this.taken));
    this.taken = plain.length;
  }

  private emit(text: string): void {
    for (const sentence of splitSentences(text)) this.onSentence(sentence);
  }
}
