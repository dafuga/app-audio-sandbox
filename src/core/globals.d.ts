interface AppAudioSandboxBrowserEvent {
	payload?: Record<string, unknown>;
	time: string;
	type: string;
}

interface Window {
	__appAudioSandbox: {
		emit: (type: string, payload?: Record<string, unknown>) => void;
		emitSpeech: (text: string, isFinal?: boolean, source?: string) => void;
		events: AppAudioSandboxBrowserEvent[];
		nativeAudio: boolean;
		setNextNativeAudioTranscript: (text: string) => void;
	};
	appAudioSandboxCaptureAudio?: (capture: unknown) => Promise<void>;
	appAudioSandboxEmit?: (event: AppAudioSandboxBrowserEvent) => Promise<void>;
}
