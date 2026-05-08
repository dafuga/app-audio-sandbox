import type { Page } from 'playwright';
import { waitFor } from '../utils/waitFor';
import { assertEqual } from './assertions';
import { fluoraConversationUrl } from './fluoraFixtures';
import { installFluoraRoutes, type FluoraRouteState } from './fluoraRoutes';
import type { SandboxScenario, ScenarioRuntime } from './types';

const DEFAULT_FLUORA_URL = 'http://localhost:8899';
const DEFAULT_FLUORA_CWD = '/Users/danielfugere/projects/fluora';

export function createFluoraScenario(name: string): SandboxScenario {
	return {
		name,
		description: `Fluora ${name} voice sandbox scenario`,
		defaultTarget: {
			appCommand: 'bun run dev',
			appCwd: DEFAULT_FLUORA_CWD,
			readyUrl: DEFAULT_FLUORA_URL,
			url: fluoraConversationUrl(DEFAULT_FLUORA_URL)
		},
		setup: setupFluoraScenario,
		run: (runtime) => runFluoraScenario(name, runtime)
	};
}

async function setupFluoraScenario(runtime: ScenarioRuntime): Promise<void> {
	const state = await installFluoraRoutes(runtime);
	await seedFluoraAuth(runtime);
	(runtime as ScenarioRuntime & { fluoraState: FluoraRouteState }).fluoraState = state;
}

async function seedFluoraAuth(runtime: ScenarioRuntime): Promise<void> {
	await runtime.context.addInitScript(() => {
		localStorage.setItem('jwt', 'voice-sandbox-token');
		localStorage.setItem('fluora_token', 'voice-sandbox-token');
		localStorage.setItem('fluora.ttsPreference', 'google-cloud-standard');
		localStorage.setItem(
			'fluora_user',
			JSON.stringify({
				id: 1,
				email: 'voice-sandbox@example.com',
				name: 'Voice Sandbox',
				active_language_id: 1
			})
		);
	});
}

async function runFluoraScenario(name: string, runtime: ScenarioRuntime): Promise<void> {
	if (name === 'fluora-echo-filter') return runEchoFilter(runtime);
	if (name === 'fluora-stt-warmup') return runSttWarmup(runtime);
	return runCutoff(runtime);
}

async function openVoiceMode(runtime: ScenarioRuntime): Promise<void> {
	await runtime.page.getByRole('button', { name: 'Start voice mode' }).click();
	await runtime.page.getByText(/Ready|Listening|Connecting/i).waitFor({ state: 'visible' });
	await waitFor(() => hasRecognition(runtime.page), 'sandbox speech recognition did not start');
	runtime.emit('scenario:voiceModeReady');
}

async function runCutoff(runtime: ScenarioRuntime): Promise<void> {
	const state = getFluoraState(runtime);
	await openVoiceMode(runtime);
	await emitSpeech(runtime, 'こんにちは 聞こえますか');
	await waitFor(
		() => state.conversationRequests.length === 1,
		'first user speech was not submitted'
	);
	await waitFor(
		() => hasEvent(runtime.page, 'nativeAudio:playBase64Audio'),
		'native TTS did not start'
	);
	await waitFor(
		() => hasEvent(runtime.page, 'mic:loopback'),
		'app audio did not reach sandbox mic'
	);
	await runtime.page.waitForTimeout(250);
	assertEqual(
		state.conversationRequests.length,
		1,
		`app audio loopback should not submit a user turn (${JSON.stringify(state.conversationRequests)})`
	);
	assertEqual(
		await eventCount(runtime.page, 'nativeAudio:stopVoicePlayback'),
		0,
		'app audio loopback should not stop itself'
	);
	await emitSpeech(runtime, 'やあ ダニエル 待って止めてください');
	await waitFor(() => state.conversationRequests.length === 2, 'cutoff speech was not submitted');
	assertEqual(
		state.conversationRequests[1],
		'待って止めてください',
		'cutoff speech should drop echoed prefix'
	);
	await waitFor(
		() => hasEvent(runtime.page, 'nativeAudio:stopVoicePlayback'),
		'native TTS was not stopped'
	);
}

async function runEchoFilter(runtime: ScenarioRuntime): Promise<void> {
	const state = getFluoraState(runtime);
	await openVoiceMode(runtime);
	await emitSpeech(runtime, 'こんにちは 聞こえますか');
	await waitFor(() => hasEvent(runtime.page, 'nativeAudio:playBase64Audio'), 'TTS did not start');
	await waitFor(
		() => hasEvent(runtime.page, 'mic:loopback'),
		'app audio did not reach sandbox mic'
	);
	await runtime.page.waitForTimeout(900);
	assertEqual(
		state.conversationRequests.length,
		1,
		'assistant echo should not create a new AI request'
	);
	assertEqual(
		await eventCount(runtime.page, 'nativeAudio:stopVoicePlayback'),
		0,
		'assistant echo should not stop voice playback'
	);
}

async function runSttWarmup(runtime: ScenarioRuntime): Promise<void> {
	const state = getFluoraState(runtime);
	await openVoiceMode(runtime);
	await runtime.page.waitForTimeout(300);
	await emitSpeech(runtime, 'ウォームアップの後でこんにちは');
	await waitFor(
		() => state.conversationRequests.length === 1,
		'speech after warmup was not submitted'
	);
	assertEqual(
		state.conversationRequests[0],
		'ウォームアップの後でこんにちは',
		'warmup speech should be preserved'
	);
}

function getFluoraState(runtime: ScenarioRuntime): FluoraRouteState {
	return (runtime as ScenarioRuntime & { fluoraState: FluoraRouteState }).fluoraState;
}

async function emitSpeech(runtime: ScenarioRuntime, text: string, isFinal = true): Promise<void> {
	await waitFor(() => hasRecognition(runtime.page), 'sandbox speech recognition did not start');
	await runtime.page.evaluate(
		(input) => window.__appAudioSandbox.emitSpeech(input.text, input.isFinal),
		{ text, isFinal }
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

async function eventCount(page: Page, type: string): Promise<number> {
	return page.evaluate((eventType) => {
		return window.__appAudioSandbox.events.filter((event) => event.type === eventType).length;
	}, type);
}
