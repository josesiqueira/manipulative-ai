// The chat loop: consent guard, typed and spoken turns, replies shown as text
// and spoken sentence by sentence through the avatar. Runs once per page.
import { AudioManager } from './audio';
import { createSpeaker, type Speaker } from './avatar';
import {
  createConversation,
  endConversation,
  getSession,
  sendMessage,
  synthesize,
  transcribe,
  type InputMode,
  type SpeechClip,
} from '../lib/participantApi';
import { splitSentences } from '../lib/sentences';
import { clearSession, getConversationId, getSessionId, setConversationId } from '../lib/session';
import { STRINGS, type Language } from '../lib/strings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export async function startChat(): Promise<void> {
  const lang = document.documentElement.lang as Language;
  const t = STRINGS[lang].chat;
  const page = $('page');
  const stage = $('stage');
  const avatarEl = $('avatar');
  const stillEl = $('still');
  const transcript = $('transcript');
  const TRANSCRIPT_PADDING = 12; // px, matches .transcript padding in chat.astro
  const form = $<HTMLFormElement>('composer');
  const input = $<HTMLInputElement>('message');
  const sendBtn = $<HTMLButtonElement>('send');
  const micBtn = $<HTMLButtonElement>('mic');
  const status = $('status');
  const hint = $('hint');
  const soundPrompt = $<HTMLButtonElement>('sound-prompt');
  const endBtn = $<HTMLButtonElement>('end');
  const backBtn = $<HTMLButtonElement>('back');

  const toConsent = () => {
    clearSession();
    window.location.replace(`/${lang}/consent`);
  };

  // 1. Consent guard, then a conversation to talk in.
  const sessionId = getSessionId();
  if (!sessionId) return toConsent();
  let conversationId: string;
  try {
    const session = await getSession(sessionId);
    if (!session || !session.consent_accepted_at) return toConsent();
    conversationId = getConversationId() ?? (await createConversation(sessionId, lang));
    setConversationId(conversationId);
  } catch (err) {
    const reason = err instanceof Error ? err.message : '';
    if (reason === 'session-missing' || reason === 'consent-required') return toConsent();
    status.textContent = t.sendError;
    return;
  }
  page.hidden = false;

  // 2. Audio and the avatar. The context is created now and unlocked on the
  // first tap release anywhere on the page.
  const audio = new AudioManager(() => (soundPrompt.hidden = false));
  const unlock = () => {
    void audio.unlock().then(() => {
      if (audio.ctx.state === 'running') soundPrompt.hidden = true;
    });
  };
  document.addEventListener('click', unlock);
  document.addEventListener('touchend', unlock, { passive: true });
  soundPrompt.addEventListener('click', unlock);

  // The leaving buttons work from the first paint, before the head has loaded.
  let speaker: Speaker | null = null;
  let speaking = false;
  const stopSpeaking = () => {
    if (!speaking) return;
    speaking = false;
    speaker?.stop();
  };
  let stream: MediaStream | null = null;
  const stopTracks = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  };
  const leave = async (to: string) => {
    stopSpeaking();
    stopTracks();
    await endConversation(conversationId);
    setConversationId(null);
    window.location.assign(to);
  };
  endBtn.addEventListener('click', () => void leave(`/${lang}/survey-entry`));
  backBtn.addEventListener('click', () => void leave(`/${lang}/`));

  stage.dataset.avatarMode = 'loading';
  speaker = await createSpeaker(avatarEl, stillEl, audio);
  stage.dataset.avatarMode = speaker.mode;
  if (speaker.mode === 'still') hint.textContent = t.stillFace;
  const head: Speaker = speaker;

  // 3. Transcript helpers.
  const addBubble = (role: 'user' | 'assistant', text: string): HTMLElement => {
    const el = document.createElement('div');
    el.className = role === 'user' ? 'bubble bubble-user' : 'bubble bubble-assistant';
    el.dataset.role = role;
    el.textContent = text;
    const previous = transcript.lastElementChild as HTMLElement | null;
    transcript.appendChild(el);
    if (role === 'assistant' && previous) {
      // A reply can be longer than the visible area on a phone: keep the
      // question at the top and let the reply start below it, instead of
      // jumping to the end and hiding what was asked.
      transcript.scrollTop = Math.max(0, previous.offsetTop - TRANSCRIPT_PADDING);
    } else {
      transcript.scrollTop = transcript.scrollHeight;
    }
    return el;
  };
  // While the head speaks, the transcript follows the highlighted words so
  // the line being spoken stays in view.
  const followSpoken = (spoken: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(spoken);
    range.collapse(false);
    let caret = range.getBoundingClientRect();
    if (caret.height === 0 && caret.top === 0) caret = spoken.getBoundingClientRect();
    const view = transcript.getBoundingClientRect();
    if (caret.bottom > view.bottom - TRANSCRIPT_PADDING * 2) {
      transcript.scrollBy({ top: caret.bottom - (view.top + view.height * 0.6), behavior: 'smooth' });
    }
  };
  const setBusy = (busy: boolean, label = '') => {
    sendBtn.disabled = busy;
    micBtn.disabled = busy;
    input.disabled = busy;
    status.textContent = label;
  };

  // 4. Speak a reply sentence by sentence, fetching the next clip while the
  // current one plays. The bubble shows the whole reply at once; the words
  // light up as they are spoken when the live head is on.
  const speakReply = async (rawText: string, bubble: HTMLElement) => {
    const sentences = splitSentences(rawText);
    if (sentences.length === 0) return;
    // The highlight counts words, so the shown text uses the same whitespace
    // as the sentences that are spoken.
    const words = sentences.join(' ').split(' ');
    const text = words.join(' ');
    speaking = true;
    status.textContent = t.speaking;
    let spokenWords = 0;
    const spoken = document.createElement('span');
    spoken.className = 'spoken';
    const rest = document.createElement('span');
    rest.textContent = text;
    bubble.textContent = '';
    bubble.append(spoken, rest);
    const prefetch = (i: number): Promise<SpeechClip> | null => {
      if (i >= sentences.length) return null;
      const p = synthesize(conversationId, sentences[i], lang);
      p.catch(() => undefined); // an unused prefetch must not surface as an unhandled rejection
      return p;
    };
    let next = prefetch(0);
    try {
      for (let i = 0; i < sentences.length && speaking; i++) {
        const clip = await next;
        next = prefetch(i + 1);
        if (!clip || !speaking) break;
        await head.speak(clip, lang, () => {
          spokenWords = Math.min(spokenWords + 1, words.length);
          spoken.textContent = words.slice(0, spokenWords).join(' ') + (spokenWords < words.length ? ' ' : '');
          rest.textContent = words.slice(spokenWords).join(' ');
          followSpoken(spoken);
        });
      }
    } catch (err) {
      console.warn('speech playback stopped', err);
      hint.textContent = t.speechError;
    } finally {
      bubble.textContent = rawText;
      speaking = false;
      if (status.textContent === t.speaking) status.textContent = '';
    }
  };
  // 5. One turn, typed or spoken.
  let busy = false;
  const turn = async (content: string, mode: InputMode) => {
    if (busy || !content.trim()) return;
    busy = true;
    stopSpeaking();
    hint.textContent = '';
    addBubble('user', content.trim());
    setBusy(true, t.thinking);
    let bubble: HTMLElement | null = null;
    let replyText = '';
    try {
      const reply = await sendMessage(conversationId, content.trim(), mode);
      replyText = reply.content;
      bubble = addBubble('assistant', replyText);
    } catch {
      hint.textContent = t.sendError;
    } finally {
      setBusy(false);
      busy = false;
      input.focus();
    }
    // Playback happens with the controls free: typing or pressing the
    // microphone interrupts the voice (barge-in).
    if (bubble) await speakReply(replyText, bubble);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const content = input.value;
    input.value = '';
    void turn(content, 'typed');
  });

  // 6. Push-to-talk: the microphone is open only while the button is held.
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let held = false; // true between pointerdown and the release
  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
  );

  const startRecording = async (event: Event) => {
    event.preventDefault();
    if (busy || recorder) return;
    held = true;
    stopSpeaking();
    hint.textContent = '';
    let granted: MediaStream;
    try {
      granted = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      held = false;
      hint.textContent = t.micDenied;
      return;
    }
    if (!held || recorder) {
      // Released while the permission prompt was open: do not record.
      granted.getTracks().forEach((track) => track.stop());
      hint.textContent = t.tapAgain;
      return;
    }
    stream = granted;
    chunks = [];
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      stopTracks();
      held = false;
      hint.textContent = t.micDenied;
      return;
    }
    recorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    });
    recorder.start();
    micBtn.classList.add('recording');
    status.textContent = t.listening;
  };

  const stopRecording = async (event: Event) => {
    event.preventDefault();
    held = false;
    const current = recorder;
    if (!current) return;
    recorder = null;
    micBtn.classList.remove('recording');
    // Wait for the recorder's own stop event, but never hang on it: some
    // browsers end the stream early and then the event never comes.
    if (current.state !== 'inactive') {
      const stopped = new Promise<void>((resolve) => {
        current.addEventListener('stop', () => resolve(), { once: true });
        window.setTimeout(resolve, 1500);
      });
      try {
        current.requestData();
      } catch {
        /* not all states allow it */
      }
      current.stop();
      await stopped;
    }
    stopTracks();
    const blob = new Blob(chunks, { type: current.mimeType || mimeType || 'application/octet-stream' });
    chunks = [];
    if (blob.size < 300) {
      status.textContent = '';
      hint.textContent = `${t.micEmpty} ${t.tapAgain}`;
      return;
    }
    busy = true;
    setBusy(true, t.transcribing);
    try {
      const text = await transcribe(conversationId, blob, lang);
      busy = false;
      setBusy(false);
      if (!text.trim()) {
        hint.textContent = `${t.micEmpty} ${t.tapAgain}`;
        return;
      }
      await turn(text, 'spoken');
    } catch {
      busy = false;
      setBusy(false);
      hint.textContent = t.speechError;
    }
  };

  micBtn.addEventListener('pointerdown', (e) => void startRecording(e));
  micBtn.addEventListener('pointerup', (e) => void stopRecording(e));
  micBtn.addEventListener('pointercancel', (e) => void stopRecording(e));
  micBtn.addEventListener('pointerleave', (e) => {
    if (recorder) void stopRecording(e);
  });
  micBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && recorder) void stopRecording(new Event('hidden'));
  });

}
