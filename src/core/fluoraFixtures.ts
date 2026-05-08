import type { Route } from 'playwright';

const CONVERSATION_ID = '4242';

export function fluoraConversationId(): string {
	return CONVERSATION_ID;
}

export function fluoraConversationUrl(baseUrl: string): string {
	return `${baseUrl.replace(/\/$/, '')}/dashboard/conversation/${CONVERSATION_ID}`;
}

export async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
	await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

export function fluoraConversationFixture() {
	return {
		language: { id: 1, code: 'ja', name: 'Japanese' },
		conversation: {
			id: Number(CONVERSATION_ID),
			scenario: 'greeting',
			messages: []
		}
	};
}

export function fluoraAiText(requestNumber: number): string {
	return requestNumber === 1
		? 'やあ ダニエル。まだ話しています。割り込まれたら止まるはずです。'
		: 'はい。止まりました。';
}

export function fakeAudioBase64(text: string): string {
	return Buffer.from(`app-audio-sandbox:${text}`).toString('base64');
}
