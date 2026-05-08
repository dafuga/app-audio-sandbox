import type { Page } from 'playwright';
import { waitFor } from '../utils/waitFor';
import { assertEqual } from './assertions';
import type { SandboxScenario, ScenarioRuntime } from './types';
import { nudgeConversationUrl, nudgeSandboxJwt } from './nudgeFixtures';
import { installNudgeRoutes, type NudgeRouteState } from './nudgeRoutes';

const DEFAULT_NUDGE_URL = 'http://127.0.0.1:1122';
const DEFAULT_NUDGE_CWD = '/Users/danielfugere/projects/nudge';

export function createNudgeScenario(name: string): SandboxScenario {
	return {
		name,
		description: `Nudge ${name} voice sandbox scenario`,
		defaultTarget: {
			appCommand: 'bun run dev',
			appCwd: DEFAULT_NUDGE_CWD,
			readyUrl: DEFAULT_NUDGE_URL,
			url: nudgeConversationUrl(DEFAULT_NUDGE_URL)
		},
		setup: setupNudgeScenario,
		run: (runtime) => runNudgeScenario(name, runtime)
	};
}

async function setupNudgeScenario(runtime: ScenarioRuntime): Promise<void> {
	const state = await installNudgeRoutes(runtime);
	await seedNudgeAuth(runtime.page);
	(runtime as ScenarioRuntime & { nudgeState: NudgeRouteState }).nudgeState = state;
}

async function runNudgeScenario(name: string, runtime: ScenarioRuntime): Promise<void> {
	if (name === 'nudge-echo-filter') return runEchoFilter(runtime);
	if (name === 'nudge-stt-warmup') return runSttWarmup(runtime);
	return runCutoff(runtime);
}

async function seedNudgeAuth(page: Page): Promise<void> {
	await page.goto('/login', { waitUntil: 'domcontentloaded' });
	await page.evaluate((token) => {
		localStorage.setItem('nudge_token', token);
		localStorage.setItem('nudge_tts_engine', 'grok');
		localStorage.setItem('nudge_user', JSON.stringify({ email: 'voice-sandbox@example.com' }));
	}, nudgeSandboxJwt());
}

async function openVoiceMode(runtime: ScenarioRuntime): Promise<void> {
	await runtime.page.goto(
		runtime.page.url().includes('/chat/') ? runtime.page.url() : '/chat/voice-cutoff-page-test'
	);
	await waitFor(
		async () => {
			if (await hasRecognition(runtime.page)) return true;
			const startButton = runtime.page.getByRole('button', { name: 'Start voice mode' });
			if ((await startButton.count()) === 0) return false;
			await startButton
				.first()
				.click()
				.catch(() => undefined);
			await runtime.page.waitForTimeout(250);
			return hasRecognition(runtime.page);
		},
		'sandbox speech recognition did not start',
		15_000
	);
	runtime.emit('scenario:voiceModeReady');
}

async function runCutoff(runtime: ScenarioRuntime): Promise<void> {
	const state = getNudgeState(runtime);
	await openVoiceMode(runtime);
	await emitSpeech(runtime, 'hello can you hear me');
	await waitFor(() => state.streamRequests.length === 1, 'first user speech was not submitted');
	await waitFor(
		() => hasRecordedEvent(runtime, 'nativeAudio:playBase64Audio'),
		'native TTS did not start',
		10_000
	);
	await waitFor(
		() => hasRecordedEvent(runtime, 'mic:loopback'),
		'app audio did not reach sandbox mic',
		10_000
	);
	await runtime.page.waitForTimeout(250);
	assertEqual(state.streamRequests.length, 1, 'app audio loopback should not submit a user turn');
	assertEqual(
		eventCount(runtime, 'nativeAudio:stopVoicePlayback'),
		0,
		'app audio loopback should not stop itself'
	);
	await emitSpeech(runtime, 'Hi Daniel wait stop please');
	await waitFor(() => state.streamRequests.length === 2, 'cutoff speech was not submitted');
	assertEqual(
		state.streamRequests[1],
		'wait stop please',
		'cutoff speech should drop echoed prefix'
	);
	await waitFor(
		() => hasRecordedEvent(runtime, 'nativeAudio:stopVoicePlayback'),
		'native TTS was not stopped',
		10_000
	);
}

async function runEchoFilter(runtime: ScenarioRuntime): Promise<void> {
	const state = getNudgeState(runtime);
	await openVoiceMode(runtime);
	await emitSpeech(runtime, 'hello can you hear me');
	await waitFor(
		() => hasRecordedEvent(runtime, 'nativeAudio:playBase64Audio'),
		'TTS did not start',
		10_000
	);
	await waitFor(
		() => hasRecordedEvent(runtime, 'mic:loopback'),
		'app audio did not reach sandbox mic',
		10_000
	);
	await runtime.page.waitForTimeout(900);
	assertEqual(state.streamRequests.length, 1, 'assistant echo should not create a new AI request');
	assertEqual(
		eventCount(runtime, 'nativeAudio:stopVoicePlayback'),
		0,
		'assistant echo should not stop voice playback'
	);
}

async function runSttWarmup(runtime: ScenarioRuntime): Promise<void> {
	const state = getNudgeState(runtime);
	await openVoiceMode(runtime);
	await runtime.page.waitForTimeout(300);
	await emitSpeech(runtime, 'hello after warmup');
	await waitFor(() => state.streamRequests.length === 1, 'speech after warmup was not submitted');
	assertEqual(state.streamRequests[0], 'hello after warmup', 'warmup speech should be preserved');
}

function getNudgeState(runtime: ScenarioRuntime): NudgeRouteState {
	return (runtime as ScenarioRuntime & { nudgeState: NudgeRouteState }).nudgeState;
}

async function emitSpeech(runtime: ScenarioRuntime, text: string, isFinal = true): Promise<void> {
	await waitFor(() => hasRecognition(runtime.page), 'sandbox speech recognition did not start');
	await runtime.page.evaluate(
		(input) => window.__appAudioSandbox.emitSpeech(input.text, input.isFinal),
		{
			text,
			isFinal
		}
	);
}

async function hasRecognition(page: Page): Promise<boolean> {
	return page.evaluate(() => Boolean(window.__appAudioSandboxRecognition));
}

async function hasEvent(page: Page, type: string): Promise<boolean> {
	return page.evaluate((eventType) => {
		return window.__appAudioSandbox.events.some((event) => event.type === eventType);
	}, type);
}

async function hasRecordedEvent(runtime: ScenarioRuntime, type: string): Promise<boolean> {
	if (runtime.recorder.getEvents().some((event) => event.type === type)) return true;
	return hasEvent(runtime.page, type);
}

function eventCount(runtime: ScenarioRuntime, type: string): number {
	return runtime.recorder.getEvents().filter((event) => event.type === type).length;
}
