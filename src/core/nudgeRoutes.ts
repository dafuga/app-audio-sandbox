import type { Route } from 'playwright';
import type { ScenarioRuntime } from './types';
import { conversationFixture, fakeAudioBase64, fulfillJson, sseResponse } from './nudgeFixtures';

export interface NudgeRouteState {
	streamRequests: string[];
	ttsRequests: string[];
}

export async function installNudgeRoutes(runtime: ScenarioRuntime): Promise<NudgeRouteState> {
	const state: NudgeRouteState = { streamRequests: [], ttsRequests: [] };
	await runtime.page.route(/\/api\/user\/profile(?:\?|$)/, (route) => profileRoute(route));
	await runtime.page.route(/\/api\/conversations(?:\?|$)/, (route) => conversationsRoute(route));
	await runtime.page.route(/\/api\/notification(?:\?|$)/, (route) => notificationsRoute(route));
	await runtime.page.route(/\/api\/messages(?:\?|$)/, (route) =>
		messagesRoute(route, runtime, state)
	);
	await runtime.page.route(/\/api\/voice\/tts(?:\?|$)/, (route) => ttsRoute(route, runtime, state));
	return state;
}

function profileRoute(route: Route): Promise<void> {
	return fulfillJson(route, {
		success: true,
		data: {
			email: 'voice-sandbox@example.com',
			name: 'Voice Sandbox',
			onboardingCompleted: true,
			picture: ''
		}
	});
}

function conversationsRoute(route: Route): Promise<void> {
	return fulfillJson(route, { success: true, data: { conversations: [conversationFixture()] } });
}

function notificationsRoute(route: Route): Promise<void> {
	return fulfillJson(route, { success: true, data: { notifications: [] } });
}

async function messagesRoute(
	route: Route,
	runtime: ScenarioRuntime,
	state: NudgeRouteState
): Promise<void> {
	const url = new URL(route.request().url());
	if (url.searchParams.get('stream') !== '1') {
		await fulfillJson(route, { success: true, data: { messages: [] } });
		return;
	}
	const payload = route.request().postDataJSON() as { message?: string };
	const message = payload.message ?? '';
	state.streamRequests.push(message);
	runtime.emit('ai:request', { message });
	await route.fulfill({
		status: 200,
		contentType: 'text/event-stream',
		body: sseResponse(state.streamRequests.length)
	});
}

async function ttsRoute(
	route: Route,
	runtime: ScenarioRuntime,
	state: NudgeRouteState
): Promise<void> {
	const payload = route.request().postDataJSON() as {
		provider?: string;
		text?: string;
		voiceName?: string;
	};
	const text = payload.text ?? '';
	state.ttsRequests.push(text);
	runtime.emit('tts:request', {
		provider: payload.provider ?? 'unknown',
		text,
		voiceName: payload.voiceName
	});
	await runtime.page.evaluate(
		(transcript) => window.__appAudioSandbox.setNextNativeAudioTranscript(transcript),
		text
	);
	if (runtime.realTts) {
		await route.continue();
		return;
	}
	await fulfillJson(route, {
		success: true,
		audioContent: fakeAudioBase64(text),
		mimeType: 'audio/mpeg',
		voiceName: payload.voiceName ?? 'sandbox'
	});
}
