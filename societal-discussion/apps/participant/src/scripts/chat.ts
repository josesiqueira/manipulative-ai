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
    void audio.unlock().then(() => (soundPrompt.hidden = true));
  };
  document.addEventListener('click', unlock);
  document.addEventListener('touchend', unlock, { passive: true });
  soundPrompt.addEventListener('click', unlock);

  stage.dataset.avatarMode = 'loading';
  const speaker: Speaker = await createSpeaker(avatarEl, stillEl, audio);
  stage.dataset.avatarMode = speaker.mode;
  if (speaker.mode === 'still') hint.textContent = t.stillFace;

  // 3. Transcript helpers.
  const addBubble = (role: 'user' | 'assistant', text: string): HTMLElement => {
    const el = document.createElement('div');
    el.className = role === 'user' ? 'bubble bubble-user' : 'bubble bubble-assistant';
    el.dataset.role = role;
    el.textContent = text;
    transcript.appendChild(el);
    transcript.scrollTop = transcript.scrollHeight;
    return el;
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
  let speaking = false;
  const speakReply = async (text: string, bubble: HTMLElement) => {
    const sentences = splitSentences(text);
    if (sentences.length === 0) return;
    speaking = true;
    status.textContent = t.speaking;
    let spokenSoFar = '';
    const spoken = document.createElement('span');
    spoken.className = 'spoken';
    const rest = document.createElement('span');
    rest.textContent = text;
    bubble.textContent = '';
    bubble.append(spoken, rest);
    let next: Promise<SpeechClip> | null = synthesize(conversationId, sentences[0], lang);
    try {
      for (let i = 0; i < sentences.length && speaking; i++) {
        const clip = await next;
        next = i + 1 < sentences.length ? synthesize(conversationId, sentences[i + 1], lang) : null;
        if (!clip || !speaking) break;
        await speaker.speak(clip, lang, (word) => {
          spokenSoFar += word;
          spoken.textContent = spokenSoFar;
          rest.textContent = text.slice(Math.min(spokenSoFar.length, text.length));
        });
      }
    } catch (err) {
      console.warn('speech playback stopped', err);
      hint.textContent = t.speechError;
    } finally {
      bubble.textContent = text;
      speaking = false;
      if (status.textContent === t.speaking) status.textContent = '';
    }
  };
  const stopSpeaking = () => {
    if (!speaking) return;
    speaking = false;
    speaker.stop();
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
    try {
      const reply = await sendMessage(conversationId, content.trim(), mode);
      const bubble = addBubble('assistant', reply.content);
      setBusy(false);
      await speakReply(reply.content, bubble);
    } catch {
      setBusy(false);
      hint.textContent = t.sendError;
    } finally {
      busy = false;
      input.focus();
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const content = input.value;
    input.value = '';
    void turn(content, 'typed');
  });

  // 6. Push-to-talk: the microphone is open only while the button is held.
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
  );

  const stopTracks = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  };

  const startRecording = async (event: Event) => {
    event.preventDefault();
    if (busy || recorder) return;
    stopSpeaking();
    hint.textContent = '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      hint.textContent = t.micDenied;
      return;
    }
    chunks = [];
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    });
    recorder.start();
    micBtn.classList.add('recording');
    status.textContent = t.listening;
  };

  const stopRecording = async (event: Event) => {
    event.preventDefault();
    const current = recorder;
    if (!current) return;
    recorder = null;
    micBtn.classList.remove('recording');
    const stopped = new Promise<void>((resolve) => current.addEventListener('stop', () => resolve(), { once: true }));
    if (current.state !== 'inactive') current.stop();
    await stopped;
    stopTracks();
    const blob = new Blob(chunks, { type: current.mimeType || mimeType || 'application/octet-stream' });
    chunks = [];
    if (blob.size < 1000) {
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

  // 7. Leaving.
  const leave = async (to: string) => {
    stopSpeaking();
    stopTracks();
    await endConversation(conversationId);
    setConversationId(null);
    window.location.assign(to);
  };
  endBtn.addEventListener('click', () => void leave(`/${lang}/survey-entry`));
  backBtn.addEventListener('click', () => void leave(`/${lang}/`));
}
