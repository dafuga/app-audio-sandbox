import type { SandboxMode } from '../core/types';

interface InstrumentationOptions {
	mode: SandboxMode;
	nativeAudio: boolean;
	nativeDurationMs: number;
}

export function createBrowserInstrumentationScript(options: InstrumentationOptions): string {
	return SCRIPT_TEMPLATE.replace('__AUDIO_SANDBOX_OPTIONS__', JSON.stringify(options));
}

const SCRIPT_TEMPLATE = `(() => {
  const options = __AUDIO_SANDBOX_OPTIONS__;
  const win = window;
  const events = [];
  const emit = (type, payload = {}) => {
    const event = { type, payload, time: new Date().toISOString() };
    events.push(event);
    win.appAudioSandboxEmit?.(event).catch?.(() => undefined);
  };
  const capture = (payload) => win.appAudioSandboxCaptureAudio?.(payload).catch?.(() => undefined);
  win.__appAudioSandbox = { events, emit, nativeAudio: options.nativeAudio };

  class FakeSpeechRecognition {
    constructor() {
      Object.assign(this, { continuous: true, interimResults: true, lang: 'en-US' });
      win.__appAudioSandboxRecognition = this;
    }
    start() {
      emit('stt:start', { lang: this.lang });
      setTimeout(() => this.onstart?.(), 0);
    }
    stop() {
      emit('stt:stop');
      setTimeout(() => this.onend?.(), 0);
    }
    emitSpeech(text, isFinal = true) {
      emit('stt:result', { text, isFinal });
      this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal, 0: { transcript: text } } } });
    }
  }

  win.__appAudioSandbox.emitSpeech = (text, isFinal = true) => {
    const recognition = win.__appAudioSandboxRecognition;
    if (!recognition) throw new Error('Speech recognition has not started');
    recognition.emitSpeech(text, isFinal);
  };
  Object.defineProperty(win, 'SpeechRecognition', { value: FakeSpeechRecognition, configurable: true });
  Object.defineProperty(win, 'webkitSpeechRecognition', { value: FakeSpeechRecognition, configurable: true });

  const OriginalUtterance = win.SpeechSynthesisUtterance;
  class FakeUtterance {
    constructor(text) { Object.assign(this, { text, lang: '', rate: 1, pitch: 1, volume: 1 }); }
  }
  Object.defineProperty(win, 'SpeechSynthesisUtterance', {
    value: OriginalUtterance || FakeUtterance,
    configurable: true
  });
  Object.defineProperty(win, 'speechSynthesis', {
    value: {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => [{ name: 'Sandbox Voice', lang: 'en-US' }],
      speak: (utterance) => {
        emit('tts:speechSynthesis:speak', { text: utterance.text });
        setTimeout(() => utterance.onstart?.(), 0);
      },
      cancel: () => emit('tts:speechSynthesis:cancel'),
      pause: () => emit('tts:speechSynthesis:pause'),
      resume: () => emit('tts:speechSynthesis:resume'),
      onvoiceschanged: null
    },
    configurable: true
  });

  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function sandboxPlay() {
    emit('media:play', { src: this.currentSrc || this.src || '' });
    if (options.mode === 'audible') return originalPlay.call(this);
    setTimeout(() => this.dispatchEvent(new Event('play')), 0);
    return Promise.resolve();
  };
  const originalPause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function sandboxPause() {
    emit('media:pause', { src: this.currentSrc || this.src || '' });
    return originalPause.call(this);
  };

  if (options.nativeAudio) {
    let stopped = false;
    win.__appAudioSandboxNativeVoicePlayback = {
      configureVoicePlayback: async () => emit('nativeAudio:configure'),
      playBase64Audio: async (audioOptions) => {
        stopped = false;
        const mimeType = audioOptions.mimeType || 'audio/mpeg';
        emit('nativeAudio:playBase64Audio', {
          bytes: Math.ceil((audioOptions.audioContent || '').length * 0.75),
          mimeType,
          volume: audioOptions.volume ?? 1
        });
        if (options.mode === 'record-audio') {
          await capture({ name: 'native-tts', source: 'nativeAudio', mimeType, base64: audioOptions.audioContent || '' });
        }
        await new Promise((resolve) => setTimeout(resolve, options.nativeDurationMs));
        emit(stopped ? 'nativeAudio:endedAfterStop' : 'nativeAudio:end');
        return { success: !stopped, elapsedMs: options.nativeDurationMs, route: 'sandbox-muted' };
      },
      stopVoicePlayback: async () => {
        stopped = true;
        emit('nativeAudio:stopVoicePlayback');
      }
    };
  }
})();`;
