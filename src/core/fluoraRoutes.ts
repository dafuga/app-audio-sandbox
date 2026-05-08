import type { Route } from 'playwright';
import type { ScenarioRuntime } from './types';
import {
	fakeAudioBase64,
	fluoraAiText,
	fluoraConversationFixture,
	fulfillJson
} from './fluoraFixtures';

export interface FluoraRouteState {
	conversationRequests: string[];
	ttsRequests: string[];
}

export async function installFluoraRoutes(runtime: ScenarioRuntime): Promise<FluoraRouteState> {
	const state: FluoraRouteState = { conversationRequests: [], ttsRequests: [] };
	await runtime.page.route(/\/api\/auth\/me(?:\?|$)/, (route) => authRoute(route));
	await runtime.page.route(/\/api\/conversation(?:\?|$)/, (route) =>
		conversationRoute(route, runtime, state)
	);
	await runtime.page.route(/\/api\/vocabulary(?:\?|$)/, (route) => vocabularyRoute(route));
	await runtime.page.route(/\/api\/voice\/tts(?:\?|$)/, (route) => ttsRoute(route, runtime, state));
	return state;
}

function authRoute(route: Route): Promise<void> {
	return fulfillJson(route, {
		success: true,
		data: {
			user: {
				id: 1,
				email: 'voice-sandbox@example.com',
				name: 'Voice Sandbox',
				active_language_id: 1
			}
		}
	});
}

function vocabularyRoute(route: Route): Promise<void> {
	return fulfillJson(route, { success: true, data: { words: [] } });
}

async function conversationRoute(
	route: Route,
	runtime: ScenarioRuntime,
	state: FluoraRouteState
): Promise<void> {
	if (route.request().method() === 'GET') {
		await fulfillJson(route, { success: true, data: fluoraConversationFixture() });
		return;
	}

	const payload = route.request().postDataJSON() as { action?: string; content?: string };
	if (payload.action !== 'continue') {
		await fulfillJson(route, { success: true, data: {} });
		return;
	}

	const message = payload.content ?? '';
	state.conversationRequests.push(message);
	runtime.emit('ai:request', { message });
	const text = fluoraAiText(state.conversationRequests.length);
	await fulfillJson(route, {
		success: true,
		data: {
			message: {
				id: state.conversationRequests.length,
				role: 'assistant',
				content: text,
				metadata: null
			}
		}
	});
}

async function ttsRoute(
	route: Route,
	runtime: ScenarioRuntime,
	state: FluoraRouteState
): Promise<void> {
	const payload = route.request().postDataJSON() as {
		engine?: string;
		text?: string;
		voiceName?: string;
		responseFormat?: string;
	};
	const text = payload.text ?? '';
	state.ttsRequests.push(text);
	runtime.emit('tts:request', {
		engine: payload.engine ?? 'unknown',
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
