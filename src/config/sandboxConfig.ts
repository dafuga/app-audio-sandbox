import type { SandboxMode, SandboxRunOptions, SandboxScenario, SandboxTarget } from '../core/types';

export const sandboxConfig = {
	defaultBrowser: 'chromium',
	defaultMode: 'silent',
	defaultTimeoutMs: 60_000,
	name: 'app-audio-sandbox'
} as const;

export function resolveMode(options: SandboxRunOptions): SandboxMode {
	if (options.audible) return 'audible';
	if (options.recordAudio) return 'record-audio';
	return 'silent';
}

export function resolveTarget(
	scenario: SandboxScenario,
	options: SandboxRunOptions
): SandboxTarget {
	return {
		appCommand: options.appCommand ?? scenario.defaultTarget.appCommand,
		appCwd: options.appCwd ?? scenario.defaultTarget.appCwd,
		readyUrl: options.url ?? scenario.defaultTarget.readyUrl,
		url: options.url ?? scenario.defaultTarget.url
	};
}
