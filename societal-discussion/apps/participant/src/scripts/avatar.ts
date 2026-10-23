// The live head (TalkingHead on three.js) with a still-face fallback. Both
// expose the same speak() so the chat loop does not care which one runs.
import type { AudioManager } from './audio';
import type { SpeechClip } from '../lib/participantApi';

export type AvatarMode = 'live' | 'still';

export interface Speaker {
  readonly mode: AvatarMode;
  speak(clip: SpeechClip, lang: 'fi' | 'en', onWord: (word: string) => void): Promise<void>;
  stop(): void;
}

// AvatarSDK sample head; bone and eyelid corrections from the library's siteconfig.js.
const HEAD = {
  url: '/avatar/man.glb',
  body: 'M',
  avatarMood: 'neutral',
  retarget: {
    Neck: { z: -0.01, rx: -0.15 },
    Neck1: { z: -0.01, rx: -0.15 },
    Neck2: { z: -0.01, rx: -0.15 },
    LeftShoulder: { rz: -0.3 },
    RightShoulder: { rz: 0.3 },
    scaleToEyesLevel: 1.0,
    origin: { y: -0.1 },
  },
  baseline: { headRotateX: -0.04, eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05 },
};

// The sample head's shirt is a strong teal printed with the vendor's logo.
// Teal borders three Finnish parties' colours, so the shirt is drawn in plain
// charcoal, a colour no party uses; the fabric's normal map keeps its folds.
export const SHIRT_COLOR = '#3a3d42';

export function recolourShirt(gltf: any): void {
  gltf.scene.traverse((node: any) => {
    if (node.isMesh && node.name === 'outfit_top' && node.material) {
      node.material.map = null;
      node.material.color.set(SHIRT_COLOR);
      node.material.needsUpdate = true;
    }
  });
}

class LiveHead implements Speaker {
  readonly mode: AvatarMode = 'live';
  private done: (() => void) | null = null;
  constructor(private head: any, private audio: AudioManager) {}

  static async create(container: HTMLElement, audio: AudioManager): Promise<LiveHead> {
    const mod: any = await import('../vendor/talkinghead/talkinghead.mjs');
    const head: any = new mod.TalkingHead(container, {
      audioCtx: audio.ctx,
      lipsyncModules: ['fi', 'en'],
      lipsyncLang: 'fi',
      cameraView: 'head',
      modelFPS: 30,
      // Pixel ratio 1: a phone renders the head at CSS size, which keeps 30 fps on mid-range devices.
      modelPixelRatio: 1,
      cameraRotateEnable: false,
      cameraPanEnable: false,
      cameraZoomEnable: false,
      avatarMood: 'neutral',
      dracoEnabled: false,
    });
    await head.showAvatar({ ...HEAD, lipsyncLang: 'fi', ttsLang: 'fi-FI', ttsVoice: 'fi-FI-Standard-A' }, null, (gltf: any) => {
      try {
        recolourShirt(gltf);
      } catch (err) {
        console.warn('Shirt colour not changed', err);
      }
    });
    return new LiveHead(head, audio);
  }

  async speak(clip: SpeechClip, lang: 'fi' | 'en', onWord: (word: string) => void): Promise<void> {
    const buffer = await this.audio.decode(clip.audio_base64);
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.done = null;
        window.clearTimeout(guard);
        resolve();
      };
      this.done = finish;
      this.head.speakAudio(
        { audio: buffer, words: clip.words, wtimes: clip.wtimes, wdurations: clip.wdurations },
        { lipsyncLang: lang },
        (word: string) => onWord(word),
      );
      // The library has no end-of-clip callback; a marker at the clip's end
      // does it, and a timer guards against a stalled audio clock.
      this.head.speakMarker(finish);
      const guard = window.setTimeout(() => {
        try {
          this.head.stopSpeaking();
        } catch {
          /* nothing queued */
        }
        finish();
      }, buffer.duration * 1000 + 4000);
    });
  }

  stop(): void {
    try {
      this.head.stopSpeaking();
    } catch {
      /* nothing queued */
    }
    if (this.done) this.done();
  }
}

class StillFace implements Speaker {
  readonly mode: AvatarMode = 'still';
  private source: AudioBufferSourceNode | null = null;
  private timers: number[] = [];
  constructor(private audio: AudioManager) {}

  async speak(clip: SpeechClip, _lang: 'fi' | 'en', onWord: (word: string) => void): Promise<void> {
    const buffer = await this.audio.decode(clip.audio_base64);
    return new Promise<void>((resolve) => {
      const src = this.audio.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.audio.ctx.destination);
      src.onended = () => {
        this.source = null;
        resolve();
      };
      this.source = src;
      const t0 = this.audio.ctx.currentTime;
      clip.words.forEach((w, i) => {
        const delay = Math.max(0, clip.wtimes[i] ?? 0);
        this.timers.push(window.setTimeout(() => onWord(w), delay));
      });
      src.start(t0);
    });
  }

  stop(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    try {
      this.source?.stop();
    } catch {
      /* already stopped */
    }
    this.source = null;
  }
}

export async function createSpeaker(container: HTMLElement, still: HTMLElement, audio: AudioManager): Promise<Speaker> {
  const canvas = document.createElement('canvas');
  const webgl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (webgl) {
    try {
      const head = await LiveHead.create(container, audio);
      return head;
    } catch (err) {
      console.warn('Live head failed, using the still face', err);
    }
  }
  container.hidden = true;
  still.hidden = false;
  return new StillFace(audio);
}
