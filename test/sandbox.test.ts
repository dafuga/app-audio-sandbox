import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { createBrowserInstrumentationScript } from '../src/adapters/browserInstrumentation';
import { resolveMode } from '../src/config/sandboxConfig';
import { EventRecorder } from '../src/core/EventRecorder';
import { nudgeSandboxJwt } from '../src/core/nudgeFixtures';
import { listScenarios } from '../src/core/scenarios';

let tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
	tempDirs = [];
});

test('resolves sandbox modes from CLI options', () => {
	expect(resolveMode({ scenario: 'nudge-voice-cutoff' })).toBe('silent');
	expect(resolveMode({ scenario: 'nudge-voice-cutoff', recordAudio: true })).toBe('record-audio');
	expect(resolveMode({ scenario: 'nudge-voice-cutoff', audible: true })).toBe('audible');
});

test('lists built-in nudge scenarios', () => {
	expect(listScenarios()).toContain('nudge-voice-cutoff');
	expect(listScenarios()).toContain('nudge-echo-filter');
	expect(listScenarios()).toContain('nudge-native-tts-routing');
	expect(listScenarios()).toContain('nudge-stt-warmup');
});

test('browser instrumentation installs muted audio hooks', () => {
	const script = createBrowserInstrumentationScript({
		loopbackAudioToMic: true,
		mode: 'record-audio',
		nativeAudio: true,
		nativeDurationMs: 1000
	});
	expect(script).toContain('__appAudioSandboxNativeVoicePlayback');
	expect(script).toContain('mic:loopback');
	expect(script).toContain('SpeechRecognition');
	expect(script).toContain('HTMLMediaElement.prototype.play');
});

test('event recorder writes events and captured audio files', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'audio-sandbox-'));
	tempDirs.push(dir);
	const recorder = new EventRecorder(dir);
	recorder.add('tts:request', { provider: 'grok' });
	await recorder.captureAudio({
		base64: Buffer.from('audio').toString('base64'),
		mimeType: 'audio/mpeg',
		name: 'clip',
		source: 'nativeAudio'
	});
	const eventsFile = await recorder.writeEvents();
	expect(recorder.getAudioFiles()).toHaveLength(1);
	expect(await readFile(eventsFile, 'utf8')).toContain('audio:capture');
});

test('event recorder writes a review timeline page', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'audio-sandbox-'));
	tempDirs.push(dir);
	await mkdir(join(dir, 'audio'), { recursive: true });
	await writeFile(join(dir, 'audio', 'ai.mp3'), 'ai');
	const recorder = new EventRecorder(dir);
	recorder.add('audio:capture', { file: join(dir, 'audio', 'ai.mp3'), source: 'nativeAudio' });
	recorder.add('stt:result', { text: 'wait stop please' });
	recorder.add('nativeAudio:stopVoicePlayback');
	const reviewFile = await recorder.writeReviewPage();
	expect(reviewFile).toBe(join(dir, 'review.html'));
	const html = await readFile(String(reviewFile), 'utf8');
	expect(html).toContain('Voice Cutoff Review');
	expect(html).toContain('wait stop please');
	expect(html).toContain('.wav');
});

test('nudge sandbox jwt has a valid jwt shape', () => {
	expect(nudgeSandboxJwt().split('.')).toHaveLength(3);
});
