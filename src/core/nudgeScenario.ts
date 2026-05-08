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
	await runtime.page.getByRole('button', { name: 'Start voice mode' }).click();
	await runtime.page.getByText(/Ready|speak now|warming/i).waitFor({ state: 'visible' });
	runtime.emit('scenario:voiceModeReady');
}

async function runCutoff(runtime: ScenarioRuntime): Promise<void> {
	const state = getNudgeState(runtime);
	await openVoiceMode(runtime);
	await emitSpeech(runtime, 'hello can you hear me');
	await waitFor(() => state.streamRequests.length === 1, 'first user speech was not submitted');
	await waitFor(
		() => hasEvent(runtime.page, 'nativeAudio:playBase64Audio'),
		'native TTS did not start'
	);
	await waitFor(
		() => hasEvent(runtime.page, 'mic:loopback'),
		'app audio did not reach sandbox mic'
	);
	await runtime.page.waitForTimeout(250);
	assertEqual(state.streamRequests.length, 1, 'app audio loopback should not submit a user turn');
	assertEqual(
		await eventCount(runtime.page, 'nativeAudio:stopVoicePlayback'),
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
		() => hasEvent(runtime.page, 'nativeAudio:stopVoicePlayback'),
		'native TTS was not stopped'
	);
}

async function runEchoFilter(runtime: ScenarioRuntime): Promise<void> {
	const state = getNudgeState(runtime);
	await openVoiceMode(runtime);
	await emitSpeech(runtime, 'hello can you hear me');
	await waitFor(() => hasEvent(runtime.page, 'nativeAudio:playBase64Audio'), 'TTS did not start');
	await waitFor(
		() => hasEvent(runtime.page, 'mic:loopback'),
		'app audio did not reach sandbox mic'
	);
	await runtime.page.waitForTimeout(900);
	assertEqual(state.streamRequests.length, 1, 'assistant echo should not create a new AI request');
	assertEqual(
		await eventCount(runtime.page, 'nativeAudio:stopVoicePlayback'),
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
	await runtime.page.evaluate(
		(input) => window.__appAudioSandbox.emitSpeech(input.text, input.isFinal),
		{
			text,
			isFinal
		}
	);
}

async function hasEvent(page: Page, type: string): Promise<boolean> {
	return page.evaluate((eventType) => {
		return window.__appAudioSandbox.events.some((event) => event.type === eventType);
	}, type);
}

async function eventCount(page: Page, type: string): Promise<number> {
	return page.evaluate((eventType) => {
		return window.__appAudioSandbox.events.filter((event) => event.type === eventType).length;
	}, type);
}
