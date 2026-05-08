interface AppAudioSandboxBrowserEvent {
	payload?: Record<string, unknown>;
	time: string;
	type: string;
}

interface Window {
	__appAudioSandbox: {
		emit: (type: string, payload?: Record<string, unknown>) => void;
		emitSpeech: (text: string, isFinal?: boolean) => void;
		events: AppAudioSandboxBrowserEvent[];
		nativeAudio: boolean;
	};
	appAudioSandboxCaptureAudio?: (capture: unknown) => Promise<void>;
	appAudioSandboxEmit?: (event: AppAudioSandboxBrowserEvent) => Promise<void>;
}
