// One AudioContext for the page, unlocked on a tap release (iOS needs a real
// gesture: click or touchend), plus a silent HTML clip on the same tap so
// iOS keeps Web Audio audible with the silent switch on. Resumed on every
// foreground return; if the clock stays frozen the page shows a tap prompt.

const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

export class AudioManager {
  readonly ctx: AudioContext;
  private silent: HTMLAudioElement;
  private wakeLock: WakeLockSentinel | null = null;
  private onNeedsTap: () => void;

  constructor(onNeedsTap: () => void) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.silent = new Audio(SILENT_WAV);
    this.silent.setAttribute('playsinline', '');
    this.onNeedsTap = onNeedsTap;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void this.resume();
    });
  }

  // Call from a click or touchend handler.
  async unlock(): Promise<void> {
    try {
      await this.ctx.resume();
    } catch {
      /* resume may reject before any gesture; the next tap tries again */
    }
    try {
      await this.silent.play();
    } catch {
      /* a muted tab or an old browser: Web Audio alone still works */
    }
    void this.requestWakeLock();
  }

  async resume(): Promise<void> {
    const before = this.ctx.currentTime;
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
    } catch {
      this.onNeedsTap();
      return;
    }
    // iOS sometimes reports "running" with a frozen clock after a lock.
    await new Promise((r) => setTimeout(r, 300));
    if (this.ctx.state !== 'running' || (this.ctx.currentTime === before && before > 0)) this.onNeedsTap();
  }

  private async requestWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => (this.wakeLock = null));
      }
    } catch {
      /* optional */
    }
  }

  async decode(base64Wav: string): Promise<AudioBuffer> {
    const bin = atob(base64Wav);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return this.ctx.decodeAudioData(bytes.buffer);
  }
}
