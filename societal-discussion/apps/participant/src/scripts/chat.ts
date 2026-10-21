// The chat loop: consent guard, typed and spoken turns, replies shown as text
// and spoken sentence by sentence through the avatar. Runs once per page.
import { AudioManager } from './audio';
import { createSpeaker, type Speaker } from './avatar';
import {
  createConversation,
  endConversation,
  getConversation,
  getMessages,
  getSession,
  sendMessage,
  synthesize,
  transcribe,
  type ChatMessage,
  type InputMode,
  type SpeechClip,
} from '../lib/participantApi';
import { BULLET, toPlainText } from '../lib/plainText';
import { splitSentences } from '../lib/sentences';
import { clearSession, getConversationId, getSessionId, isSurveySubmitted, sessionCode, setConversationId } from '../lib/session';
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

  // A missing, unconsented or finished session (the survey is done) starts
  // again through consent, as a new participant.
  const toConsent = () => {
    clearSession();
    window.location.replace(`/${lang}/consent`);
  };
  const startError = (text: string, link?: { href: string; label: string }) => {
    $('error-text').textContent = text;
    if (link) {
      const a = $<HTMLAnchorElement>('error-link');
      a.href = link.href;
      a.textContent = link.label;
    }
    $('error').hidden = false;
  };

  // 1. Consent guard, then a conversation to talk in: the stored one with its
  // earlier messages (a reload or a return shows them again), or a new one
  // when there is none or it has ended.
  const sessionId = getSessionId();
  if (!sessionId || isSurveySubmitted()) return toConsent();
  let conversationId: string | null = null;
  let history: ChatMessage[] = [];
  try {
    const session = await getSession(sessionId);
    if (!session || !session.consent_accepted_at) return toConsent();
    const stored = getConversationId();
    if (stored) {
      const [existing, messages] = await Promise.all([getConversation(stored), getMessages(stored).catch(() => [])]);
      if (existing && !existing.is_complete) {
        conversationId = stored;
        history = messages;
      }
    }
    conversationId ??= await createConversation(sessionId, lang);
    setConversationId(conversationId);
  } catch (err) {
    const reason = err instanceof Error ? err.message : '';
    if (reason === 'session-missing' || reason === 'consent-required' || reason === 'session-finished') return toConsent();
    if (reason === 'too-many-conversations') return startError(t.tooManyConversations, { href: `/${lang}/survey-entry`, label: t.toSurvey });
    return startError(STRINGS[lang].consent.error);
  }
  const conversation: string = conversationId;
  page.hidden = false;

  // 2. Transcript helpers, then the earlier messages (shown, not spoken).
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
  for (const message of history) {
    const text = message.role === 'assistant' ? toPlainText(message.content) : message.content;
    if (text) addBubble(message.role === 'assistant' ? 'assistant' : 'user', text);
  }

  // The session code, so that someone who stops midway can still ask for
  // their data to be deleted.
  const code = sessionCode(sessionId);
  const copyBtn = $<HTMLButtonElement>('copy-code');
  $('session-code').textContent = code;
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      copyBtn.textContent = t.copied;
    } catch {
      // Clipboard blocked: the code stays on screen.
    }
  });

  // 3. Audio and the avatar. The context is created now and unlocked on the
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
  // Counts interruptions, so a reply still waiting for the head is not
  // spoken after the participant has moved on.
  let interruptions = 0;
  const stopSpeaking = () => {
    interruptions++;
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
    await endConversation(conversation);
    setConversationId(null);
    window.location.assign(to);
  };
  endBtn.addEventListener('click', () => void leave(`/${lang}/survey-entry`));
  backBtn.addEventListener('click', () => void leave(`/${lang}/`));

  // The head loads in the background: a message can be sent before it is
  // ready (on a slow phone that takes seconds), and only its voice waits.
  stage.dataset.avatarMode = 'loading';
  const headReady: Promise<Speaker> = createSpeaker(avatarEl, stillEl, audio).then((loaded) => {
    speaker = loaded;
    stage.dataset.avatarMode = loaded.mode;
    if (loaded.mode === 'still') hint.textContent = t.stillFace;
    return loaded;
  });

  // 4. Speak a reply sentence by sentence, fetching the next clip while the
  // current one plays. The bubble shows the whole reply at once; the words
  // light up as they are spoken when the live head is on. The text is the
  // reply's plain text (toPlainText): the same for the bubble, the highlight
  // and the voice.
  const speakReply = async (text: string, bubble: HTMLElement) => {
    const sentences = splitSentences(text);
    if (sentences.length === 0) return;
    const before = interruptions;
    const head = await headReady;
    if (before !== interruptions) return;
    // The highlight counts spoken words over the shown text and keeps its
    // line breaks; a list bullet is not a spoken word.
    const tokens = text.split(/(\s+)/);
    const wordEnds: number[] = [];
    tokens.forEach((token, i) => {
      if (token.trim() && token !== BULLET) wordEnds.push(i + 1);
    });
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
      const p = synthesize(conversation, sentences[i], lang);
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
          spokenWords = Math.min(spokenWords + 1, wordEnds.length);
          const cut = wordEnds[spokenWords - 1] ?? 0;
          spoken.textContent = tokens.slice(0, cut).join('');
          rest.textContent = tokens.slice(cut).join('');
          followSpoken(spoken);
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

  // 5. Waiting and failing. While the reply is on its way, an assistant
  // bubble with moving dots stands in the transcript; after a while it says
  // that a reply can take half a minute.
  let waiting: { el: HTMLElement; timer: number } | null = null;
  const showWaiting = () => {
    const el = document.createElement('div');
    el.className = 'bubble bubble-assistant bubble-waiting';
    el.dataset.testid = 'waiting';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', t.thinking);
    const dots = document.createElement('span');
    dots.className = 'dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.append(...[0, 1, 2].map(() => document.createElement('span')));
    const note = document.createElement('span');
    note.className = 'waiting-note';
    el.append(dots, note);
    transcript.appendChild(el);
    transcript.scrollTop = transcript.scrollHeight;
    const timer = window.setTimeout(() => {
      note.textContent = t.thinkingSlow;
      transcript.scrollTop = transcript.scrollHeight;
    }, 8000);
    waiting = { el, timer };
  };
  const hideWaiting = () => {
    if (!waiting) return;
    window.clearTimeout(waiting.timer);
    waiting.el.remove();
    waiting = null;
  };
  // A problem line above the input, with an optional button.
  const showProblem = (text: string, action?: { label: string; run: () => void }) => {
    hint.textContent = text;
    hint.classList.add('is-error');
    if (!action) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hint-action';
    button.textContent = action.label;
    button.addEventListener('click', action.run);
    hint.append(' ', button);
  };
  const clearProblem = () => {
    hint.textContent = '';
    hint.classList.remove('is-error');
  };
  // A message that did not go through: its bubble goes, the text goes back
  // into the input so nothing has to be typed again, and the reason is shown.
  const sendFailed = (content: string, userBubble: HTMLElement, err: unknown) => {
    userBubble.remove();
    if (!input.value.trim()) input.value = content;
    const reason = err instanceof Error ? err.message : '';
    if (reason === 'too-many-messages') return showProblem(t.tooManyMessages);
    if (reason === 'conversation-closed') {
      return showProblem(t.conversationClosed, {
        label: t.newConversation,
        run: () => {
          setConversationId(null);
          window.location.reload();
        },
      });
    }
    showProblem(t.sendError);
  };

  // 6. One turn, typed or spoken.
  let busy = false;
  const turn = async (content: string, mode: InputMode) => {
    if (busy || !content.trim()) return;
    busy = true;
    stopSpeaking();
    clearProblem();
    const userBubble = addBubble('user', content.trim());
    setBusy(true, t.thinking);
    showWaiting();
    let bubble: HTMLElement | null = null;
    let replyText = '';
    try {
      const reply = await sendMessage(conversation, content.trim(), mode);
      replyText = toPlainText(reply.content);
      hideWaiting();
      bubble = addBubble('assistant', replyText);
    } catch (err) {
      hideWaiting();
      sendFailed(content.trim(), userBubble, err);
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
    if (busy || !content.trim()) return;
    input.value = '';
    void turn(content, 'typed');
  });

  // 7. Push-to-talk: the microphone is open only while the button is held.
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
    clearProblem();
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
      const text = await transcribe(conversation, blob, lang);
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

  // A head that fails to load still surfaces as the page's error line.
  await headReady;
}
