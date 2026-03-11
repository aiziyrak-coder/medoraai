/**
 * AiDoktor-Jarvis Speech Service
 * =============================
 * Azure Speech Services bilan ishlash:
 *   вЂў STT (Speech-to-Text) вЂ“ browser mic в†’ matn
 *   вЂў TTS (Text-to-Speech) вЂ“ matn в†’ ovoz
 *   вЂў MediaRecorder вЂ“ suhbat yozib olish + backend ga yuklash
 *
 * Arxitektura:
 *   1. Real-time STT: Azure Speech SDK (browser WebSocket) yoki Web Speech API
 *   2. Batch STT:     Audio yozib в†’ backend /api/jarvis/speech/stt/ ga yuklash
 *   3. TTS:           Backend /api/jarvis/speech/tts/ в†’ base64 MP3 в†’ Audio play
 */

import { apiPost, API_BASE_URL } from './api';

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Types
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface SpeechToken {
  token:      string;
  region:     string;
  expires_in: number;
}

export interface STTResult {
  text:        string;
  confidence:  number;
  duration_ms: number;
  status:      'success' | 'no_match' | 'error';
}

export interface TTSResult {
  audio_base64: string;
  format:       string;
  language:     string;
  char_count:   number;
}

export interface TranscriptChunk {
  t:       number;
  speaker: 'doctor' | 'patient' | 'system' | 'unknown';
  text:    string;
}

export type SpeechLanguage = 'uz-L' | 'uz-C' | 'ru' | 'en' | 'kaa';

// Azure locale mappings
const AZURE_LOCALE: Record<SpeechLanguage, string> = {
  'uz-L': 'uz-UZ',
  'uz-C': 'uz-UZ',
  'ru':   'ru-RU',
  'en':   'en-US',
  'kaa':  'kk-KZ',
};

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Token cache
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

let _tokenCache: { token: SpeechToken; expiry: number } | null = null;

async function getSpeechToken(): Promise<SpeechToken> {
  if (_tokenCache && _tokenCache.expiry > Date.now()) {
    return _tokenCache.token;
  }
  const resp = await apiPost<SpeechToken>('/ziyrak/speech/token/', {});
  if (!resp.success || !resp.data) {
    throw new Error('Azure Speech token olishda xatolik');
  }
  const token = resp.data;
  _tokenCache = { token, expiry: Date.now() + token.expires_in * 1000 };
  return token;
}

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Text-to-Speech (backend orqali)
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

let _currentAudio: HTMLAudioElement | null = null;

export async function speakText(
  text:       string,
  language:   SpeechLanguage = 'uz-L',
  voiceMode:  boolean = true,
): Promise<void> {
  if (!text.trim()) return;

  // Oldingi ovozni to'xtat
  stopSpeaking();

  const resp = await apiPost<TTSResult>('/ziyrak/speech/tts/', {
    text,
    language,
    voice_mode: voiceMode,
  });

  if (!resp.success || !resp.data?.audio_base64) {
    throw new Error('TTS xatolik');
  }

  // Base64 в†’ Blob в†’ Audio
  const audioBytes  = atob(resp.data.audio_base64);
  const buffer      = new Uint8Array(audioBytes.length);
  for (let i = 0; i < audioBytes.length; i++) buffer[i] = audioBytes.charCodeAt(i);
  const blob        = new Blob([buffer], { type: 'audio/mpeg' });
  const url         = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    _currentAudio = audio;
    audio.onended  = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror  = (e) => { URL.revokeObjectURL(url); reject(e); };
    audio.play().catch(reject);
  });
}

export function stopSpeaking(): void {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.currentTime = 0;
    _currentAudio = null;
  }
}

export function isSpeaking(): boolean {
  return !!(_currentAudio && !_currentAudio.paused);
}

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Real-time STT (Web Speech API вЂ” Azure SDK fallback)
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type OnTranscriptFn = (text: string, isFinal: boolean) => void;
type OnErrorFn      = (err: string) => void;

export class RealtimeSTT {
  private recognition: SpeechRecognition | null = null;
  private language:    SpeechLanguage;
  private isRunning:   boolean = false;
  private interim:     string  = '';

  constructor(language: SpeechLanguage = 'uz-L') {
    this.language = language;
  }

  get running(): boolean { return this.isRunning; }

  start(
    onTranscript: OnTranscriptFn,
    onError:      OnErrorFn,
    continuous:   boolean = true,
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      onError('Bu brauzer Web Speech API ni qo\'llab-quvvatlamaydi. Chrome yoki Edge ishlatib ko\'ring.');
      return;
    }

    this.recognition = new SpeechRecognitionClass() as SpeechRecognition;
    this.recognition.lang            = AZURE_LOCALE[this.language] || 'uz-UZ';
    this.recognition.continuous      = continuous;
    this.recognition.interimResults  = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript   = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      if (interimTranscript) {
        this.interim = interimTranscript;
        onTranscript(interimTranscript, false);
      }
      if (finalTranscript) {
        this.interim = '';
        onTranscript(finalTranscript.trim(), true);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech') {
        onError(`STT xatolik: ${event.error}`);
      }
    };

    this.recognition.onend = () => {
      if (this.isRunning && continuous) {
        // Auto-restart for continuous mode
        try {
          this.recognition?.start();
        } catch {
          this.isRunning = false;
        }
      } else {
        this.isRunning = false;
      }
    };

    try {
      this.recognition.start();
      this.isRunning = true;
    } catch (e) {
      onError(`Mikrofon boshlashda xatolik: ${e}`);
    }
  }

  stop(): void {
    this.isRunning = false;
    try {
      this.recognition?.stop();
    } catch {
      // ignore
    }
    this.recognition = null;
  }

  getInterim(): string {
    return this.interim;
  }
}

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Audio Recorder (MediaRecorder API)
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null   = null;
  private audioChunks:   Blob[]                 = [];
  private stream:        MediaStream | null      = null;
  private _isRecording:  boolean                 = false;
  private analyserNode:  AnalyserNode | null     = null;
  private audioContext:  AudioContext | null     = null;

  get isRecording(): boolean { return this._isRecording; }
  get analyser():    AnalyserNode | null { return this.analyserNode; }

  async start(): Promise<void> {
    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount:    1,
        sampleRate:      16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Waveform uchun AnalyserNode
    this.audioContext  = new AudioContext({ sampleRate: 16000 });
    this.analyserNode  = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    const source = this.audioContext.createMediaStreamSource(this.stream);
    source.connect(this.analyserNode);

    // Prefer WebM/Opus, fallback to WAV
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/ogg;codecs=opus';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };
    this.mediaRecorder.start(1000); // 1s chunks
    this._isRecording = true;
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) { resolve(new Blob()); return; }
      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob     = new Blob(this.audioChunks, { type: mimeType });
        this._cleanUp();
        resolve(blob);
      };
      this.mediaRecorder.stop();
      this._isRecording = false;
    });
  }

  private _cleanUp(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.audioContext?.close();
    this.analyserNode  = null;
    this.audioContext  = null;
    this.stream        = null;
    this.mediaRecorder = null;
  }

  /** Audio blob'ni backend ga yuklash va transkript olish. */
  async uploadAndTranscribe(
    blob:     Blob,
    language: SpeechLanguage = 'uz-L',
  ): Promise<STTResult> {
    const format  = blob.type.includes('ogg') ? 'ogg' : 'webm';
    const b64data = await _blobToBase64(blob);
    const resp    = await apiPost<STTResult>('/ziyrak/speech/stt/', {
      audio_base64: b64data.split(',')[1],
      language,
      format,
    });
    if (!resp.success || !resp.data) {
      throw new Error('STT xatolik');
    }
    return resp.data;
  }
}

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Jarvis API calls
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface JarvisSession {
  session_id: string;
  language:   string;
  created_at: string;
}

export interface JarvisChatResult {
  text:             string;
  session_id:       string;
  is_critical:      boolean;
  critical_message: string;
  guard_blocked?:   boolean;
  filter_level?:    string;
  audio_base64?:    string;
  audio_format?:    string;
}

export interface ConsultationDiagnosis {
  patient_complaints_summary:  string;
  primary_diagnosis:           Record<string, unknown>;
  differential_diagnoses:      unknown[];
  treatment_plan:              string[];
  medications:                 unknown[];
  recommended_tests:           string[];
  critical_findings:           string[];
  follow_up:                   string;
  _session_id:                 string;
  _generated_at:               string;
  error?:                      string;
}

export const createJarvisSession = async (
  language:    SpeechLanguage = 'uz-L',
  patientData?: Record<string, unknown>,
) => apiPost<JarvisSession>('/ziyrak/session/create/', {
  language,
  patient_data: patientData || {},
});

export const endJarvisSession = async (sessionId: string) =>
  apiPost(`/jarvis/session/${sessionId}/end/`, {});

export const jarvisChat = async (
  sessionId:   string,
  message:     string,
  voiceMode:   boolean = true,
  withTts:     boolean = false,
  language:    SpeechLanguage = 'uz-L',
) => apiPost<JarvisChatResult>('/ziyrak/chat/', {
  session_id: sessionId,
  message,
  voice_mode: voiceMode,
  with_tts:   withTts,
  language,
});

export const addTranscriptChunk = async (
  sessionId: string,
  text:      string,
  speaker:   'doctor' | 'patient' | 'system' = 'unknown',
) => apiPost('/ziyrak/transcript/add/', {
  session_id: sessionId,
  text,
  speaker,
});

export const generateConsultationDiagnosis = async (
  sessionId: string,
  language:  SpeechLanguage = 'uz-L',
) => apiPost<ConsultationDiagnosis>('/ziyrak/diagnosis/', {
  session_id: sessionId,
  language,
});

/**
 * Jarvis streaming chat with SSE.
 * Returns cancel function.
 */
export const jarvisChatStream = (
  sessionId:  string,
  message:    string,
  voiceMode:  boolean,
  onChunk:    (text: string) => void,
  onDone:     (fullText: string, isCritical: boolean) => void,
  onError:    (err: string) => void,
): (() => void) => {
  let aborted  = false;
  let fullText = '';
  const token  = localStorage.getItem('access_token') || '';

  fetch(`${API_BASE_URL}/jarvis/chat/stream/`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ session_id: sessionId, message, voice_mode: voiceMode }),
  })
    .then(async (resp) => {
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as { error?: { message?: string } };
        onError(body?.error?.message || `HTTP ${resp.status}`);
        return;
      }
      const reader  = resp.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { onError('Stream unavailable'); return; }

      while (!aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') { onDone(fullText, false); return; }
          try {
            const obj = JSON.parse(payload) as {
              chunk?: string; error?: string; done?: boolean; is_critical?: boolean;
            };
            if (obj.error) { onError(obj.error); return; }
            if (obj.done)  { onDone(fullText, obj.is_critical || false); return; }
            if (obj.chunk) { fullText += obj.chunk; onChunk(fullText); }
          } catch { /* skip */ }
        }
      }
      onDone(fullText, false);
    })
    .catch((e: unknown) => { if (!aborted) onError(String(e)); });

  return () => { aborted = true; };
};

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Audio waveform data (for AudioVisualizer)
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export function getWaveformData(analyser: AnalyserNode): Uint8Array {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  return data;
}

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Helpers
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

function _blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror   = reject;
    reader.readAsDataURL(blob);
  });
}

export { getSpeechToken };