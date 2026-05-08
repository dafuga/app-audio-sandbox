import type { BrowserContext, Page, Route } from 'playwright';
import type { EventRecorder } from './EventRecorder';

export type SandboxMode = 'silent' | 'record-audio' | 'audible';
export type SandboxBrowser = 'chromium' | 'firefox' | 'webkit';

export interface SandboxRunOptions {
	scenario: string;
	appCommand?: string;
	appCwd?: string;
	attach?: boolean;
	audible?: boolean;
	browser?: SandboxBrowser;
	configPath?: string;
	headed?: boolean;
	outDir?: string;
	recordAudio?: boolean;
	realTts?: boolean;
	timeoutMs?: number;
	url?: string;
}

export interface SandboxTarget {
	appCommand?: string;
	appCwd?: string;
	readyUrl?: string;
	url: string;
}

export interface SandboxEvent {
	type: string;
	time: string;
	payload?: Record<string, unknown>;
}

export interface AudioCapture {
	base64: string;
	extension?: string;
	mimeType?: string;
	name: string;
	provider?: string;
	source: string;
	text?: string;
	voiceName?: string;
}

export interface ScenarioRuntime {
	context: BrowserContext;
	emit: (type: string, payload?: Record<string, unknown>) => void;
	mode: SandboxMode;
	page: Page;
	recordAudio: (capture: AudioCapture) => void;
	recorder: EventRecorder;
	realTts: boolean;
	routeJson: (route: Route, body: unknown, status?: number) => Promise<void>;
}

export interface SandboxScenario {
	defaultTarget: SandboxTarget;
	description: string;
	name: string;
	setup?: (runtime: ScenarioRuntime) => Promise<void>;
	run: (runtime: ScenarioRuntime) => Promise<void>;
}

export interface SandboxRunResult {
	artifactsDir: string;
	audioFiles: string[];
	eventsFile: string;
	reviewFile?: string;
	screenshotFile?: string;
	scenario: string;
	traceFile?: string;
	videoFiles: string[];
}
