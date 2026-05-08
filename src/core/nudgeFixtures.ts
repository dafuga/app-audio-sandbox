import type { Route } from 'playwright';

const CONVERSATION_ID = 'voice-cutoff-page-test';

export function nudgeConversationId(): string {
	return CONVERSATION_ID;
}

export function nudgeConversationUrl(baseUrl: string): string {
	return `${baseUrl.replace(/\/$/, '')}/chat/${CONVERSATION_ID}`;
}

export async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
	await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

export function conversationFixture() {
	return {
		id: CONVERSATION_ID,
		title: 'Voice sandbox test',
		message_count: 0,
		created_at: '2026-05-08T00:00:00.000Z',
		updated_at: '2026-05-08T00:00:00.000Z'
	};
}

export function sseResponse(requestNumber: number): string {
	const text =
		requestNumber === 1
			? 'Hi Daniel. I am still talking and should stop when interrupted.'
			: 'Okay. I stopped.';
	return [
		'event: chunk',
		`data: ${JSON.stringify({ text })}`,
		'',
		'event: done',
		`data: ${JSON.stringify({ text, widgets: [] })}`,
		'',
		''
	].join('\n');
}

export function fakeAudioBase64(text: string): string {
	return Buffer.from(`app-audio-sandbox:${text}`).toString('base64');
}
