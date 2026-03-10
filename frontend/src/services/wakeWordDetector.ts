/**
 * "Salom Ziyrak" Wake Word Detector
 * ====================================
 * Web Speech API orqali doimiy fon tinglash.
 * Faqat "Salom Ziyrak" so'zi aytilganda tizim faollashadi.
 *
 * Arxitektura:
 *   BackgroundListener (doim ishlaydi, past kuch) →
 *   "salom ziyrak" topilsa → onWakeWord() callback →
 *   Ziyrak to'liq interaktiv rejimga o'tadi
 *
 * Noise suppression va mobile keep-alive ham shu yerda.
 */

export type WakeWordCallback = () => void;
export type WakeWordErrorCallback = (err: string) => void;

// Qabul qilinadigan "salom ziyrak" variantlari (talaffuz farqlari)
const WAKE_WORD_VARIANTS: string[] = [
  "salom ziyrak",
  "salom ziyrak",
  "salom zyrak",
  "salom zirak",
  "sало зийрак",       // kiril
  "привет зийрак",
  "hello ziyrak",
  "hey ziyrak",
  "ziyrak",           // qisqa: faqat ism ham qabul qilinadi
];

function _matchesWakeWord(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return WAKE_WORD_VARIANTS.some(variant => lower.includes(variant));
}

// ─────────────────────────────────────────────────────────────────────────────
// BackgroundListener class
// ─────────────────────────────────────────────────────────────────────────────

export class WakeWordDetector {
  private recognition: SpeechRecognition | null = null;
  private _isRunning:  boolean = false;
  private _isAwake:    boolean = false;
  private onWakeWord:  WakeWordCallback | null = null;
  private onError:     WakeWordErrorCallback | null = null;
  private language:    string;
  private _restartTimer: ReturnType<typeof setTimeout> | null = null;
  private _wakeTimeout:  ReturnType<typeof setTimeout> | null = null;
  private noSpeechCount: number = 0;

  constructor(language: string = "uz-L") {
    this.language = language;
  }

  get isRunning(): boolean { return this._isRunning; }
  get isAwake():   boolean { return this._isAwake; }

  private _getLang(): string {
    const map: Record<string, string> = {
      "uz-L": "uz-UZ",
      "uz-C": "uz-UZ",
      "ru":   "ru-RU",
      "en":   "en-US",
    };
    return map[this.language] || "uz-UZ";
  }

  /**
   * Fon tinglashni boshlash.
   * Brauzer mikrofon ruxsati bir marta so'raladi.
   */
  start(
    onWakeWord: WakeWordCallback,
    onError:    WakeWordErrorCallback = () => {},
  ): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      onError("Bu brauzer ovozni tanishni qo'llab-quvvatlamaydi. Chrome ishlatib ko'ring.");
      return false;
    }

    this.onWakeWord = onWakeWord;
    this.onError    = onError;

    this._setupRecognition(SR);
    this._isRunning = true;
    this._safeStart();
    return true;
  }

  private _setupRecognition(SR: typeof SpeechRecognition): void {
    this.recognition = new SR() as SpeechRecognition;
    this.recognition.lang            = this._getLang();
    this.recognition.continuous      = true;
    this.recognition.interimResults  = true;
    this.recognition.maxAlternatives = 3;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        // Barcha alternativalarni tekshirish
        for (let j = 0; j < result.length; j++) {
          const transcript = result[j].transcript;
          if (_matchesWakeWord(transcript)) {
            this._triggerWakeWord();
            return;
          }
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        this.noSpeechCount++;
        // no-speech ko'p bo'lsa restart
        if (this.noSpeechCount > 5) {
          this.noSpeechCount = 0;
          this._scheduleRestart(500);
        }
        return;
      }
      if (event.error === "aborted") return;
      if (event.error === "not-allowed") {
        this.onError?.("Mikrofon ruxsati berilmagan.");
        this._isRunning = false;
        return;
      }
      // Boshqa xatoliklarda 2s restart
      this._scheduleRestart(2000);
    };

    this.recognition.onend = () => {
      if (this._isRunning && !this._isAwake) {
        // Continuous mode uchun avtomatik restart
        this._scheduleRestart(300);
      }
    };
  }

  private _triggerWakeWord(): void {
    if (this._isAwake) return;
    this._isAwake = true;
    this.recognition?.stop();

    // 30 soniya keyin uxlatish (foydalanuvchi gapirmasa)
    this._wakeTimeout = setTimeout(() => {
      this.sleep();
    }, 30000);

    this.onWakeWord?.();
  }

  /** Ziyrak uyg'ongan holatdan uxlash rejimine o'tish */
  sleep(): void {
    this._isAwake = false;
    if (this._wakeTimeout) {
      clearTimeout(this._wakeTimeout);
      this._wakeTimeout = null;
    }
    if (this._isRunning) {
      this._safeStart();
    }
  }

  /** Tinglashni to'xtatish */
  stop(): void {
    this._isRunning = false;
    this._isAwake   = false;
    if (this._restartTimer) {
      clearTimeout(this._restartTimer);
      this._restartTimer = null;
    }
    if (this._wakeTimeout) {
      clearTimeout(this._wakeTimeout);
      this._wakeTimeout = null;
    }
    try {
      this.recognition?.stop();
    } catch { /* ignore */ }
    this.recognition = null;
  }

  private _safeStart(): void {
    try {
      this.recognition?.start();
      this.noSpeechCount = 0;
    } catch {
      // Already started - ignore
    }
  }

  private _scheduleRestart(delayMs: number): void {
    if (this._restartTimer) clearTimeout(this._restartTimer);
    this._restartTimer = setTimeout(() => {
      if (this._isRunning && !this._isAwake) {
        this._safeStart();
      }
    }, delayMs);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Keep-Alive (telefon uxlashini oldini olish)
// ─────────────────────────────────────────────────────────────────────────────

let _wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock(): Promise<boolean> {
  try {
    if ("wakeLock" in navigator) {
      _wakeLock = await navigator.wakeLock.request("screen");
      _wakeLock.addEventListener("release", () => {
        _wakeLock = null;
        // Auto re-acquire
        setTimeout(() => requestWakeLock(), 1000);
      });
      return true;
    }
  } catch {
    // WakeLock not supported or denied
  }
  return false;
}

export async function releaseWakeLock(): Promise<void> {
  if (_wakeLock) {
    await _wakeLock.release();
    _wakeLock = null;
  }
}

// Visibility change uchun wake lock qayta olish
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !_wakeLock) {
      requestWakeLock();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio Noise Suppression Helper
// ─────────────────────────────────────────────────────────────────────────────

export interface NoiseFilteredStream {
  stream:       MediaStream;
  audioContext: AudioContext;
  sourceNode:   MediaStreamAudioSourceNode;
}

/**
 * Operatsiya xonasi shovqinlarini filtrlash.
 * Browser built-in echo cancellation + noise suppression.
 */
export async function getMicStreamWithNoiseFilter(
  forSurgery: boolean = false,
): Promise<NoiseFilteredStream> {
  const constraints: MediaStreamConstraints = {
    audio: {
      channelCount:        1,
      sampleRate:          16000,
      echoCancellation:    true,
      noiseSuppression:    true,
      autoGainControl:     true,
      // Extended constraints (Chrome orqali)
      // @ts-expect-error experimental
      googNoiseSuppression: true,
      // @ts-expect-error experimental
      googHighpassFilter:   forSurgery, // Operatsiya asboblari shovqinini filtrlash
      // @ts-expect-error experimental
      googEchoCancellation: true,
      // @ts-expect-error experimental
      googAutoGainControl:  true,
    },
  };

  const stream      = await navigator.mediaDevices.getUserMedia(constraints);
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const sourceNode  = audioContext.createMediaStreamSource(stream);

  if (forSurgery) {
    // High-pass filter: past chastota shovqinlarini yo'qotish (asboblar shovqini)
    const highPassFilter = audioContext.createBiquadFilter();
    highPassFilter.type      = "highpass";
    highPassFilter.frequency.value = 300; // 300Hz dan past shovqinlarni kesish
    sourceNode.connect(highPassFilter);

    // Notch filter: 50Hz elektr shovqinini yo'qotish
    const notchFilter = audioContext.createBiquadFilter();
    notchFilter.type      = "notch";
    notchFilter.frequency.value = 50;
    notchFilter.Q.value   = 10;
    highPassFilter.connect(notchFilter);
  }

  return { stream, audioContext, sourceNode };
}
