import { execFile } from 'node:child_process';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import { createReviewHtml } from './reviewPage';
import type { AudioCapture, SandboxEvent } from './types';

const execFileAsync = promisify(execFile);
const AFCONVERT_PATH = '/usr/bin/afconvert';
const MACOS_SAY_PATH = '/usr/bin/say';

export class EventRecorder {
	private readonly audioFiles: string[] = [];
	private readonly events: SandboxEvent[] = [];

	constructor(private readonly artifactDir: string) {}

	add(type: string, payload?: Record<string, unknown>): void {
		this.events.push({ type, payload, time: new Date().toISOString() });
	}

	async captureAudio(capture: AudioCapture): Promise<void> {
		const extension = capture.extension ?? extensionFromMime(capture.mimeType);
		const fileName = `${safeName(capture.name)}-${this.audioFiles.length + 1}.${extension}`;
		const filePath = join(this.artifactDir, 'audio', fileName);
		await mkdir(join(this.artifactDir, 'audio'), { recursive: true });
		await writeFile(filePath, Buffer.from(capture.base64, 'base64'));
		this.audioFiles.push(filePath);
		this.add('audio:capture', {
			file: filePath,
			mimeType: capture.mimeType,
			provider: capture.provider,
			source: capture.source,
			text: capture.text,
			voiceName: capture.voiceName
		});
	}

	async writeReviewPage(): Promise<string | undefined> {
		const speechFiles = await this.captureSpeechReviewFiles();
		const html = createReviewHtml(this.events, this.artifactDir, speechFiles);
		if (!html) return undefined;
		const filePath = join(this.artifactDir, 'review.html');
		await writeFile(filePath, html);
		return filePath;
	}

	async writeEvents(): Promise<string> {
		const filePath = join(this.artifactDir, 'events.json');
		await mkdir(this.artifactDir, { recursive: true });
		await writeFile(filePath, JSON.stringify(this.events, null, 2));
		return filePath;
	}

	getAudioFiles(): string[] {
		return [...this.audioFiles];
	}

	getEvents(): SandboxEvent[] {
		return [...this.events];
	}

	private async nextAudioPath(name: string, extension: string): Promise<string> {
		const fileName = `${safeName(name)}-${this.audioFiles.length + 1}.${extension}`;
		const filePath = join(this.artifactDir, 'audio', fileName);
		await mkdir(join(this.artifactDir, 'audio'), { recursive: true });
		return filePath;
	}

	private async captureSpeechReviewFiles(): Promise<Map<SandboxEvent, string>> {
		const speechFiles = new Map<SandboxEvent, string>();
		if (!(await canUseMacSpeechReview())) return speechFiles;
		for (const event of this.events) {
			if (event.type !== 'stt:result') continue;
			if (event.payload?.source === 'nativeAudio-loopback') continue;
			const filePath = await this.captureSpeechReviewFile(event);
			if (filePath) speechFiles.set(event, filePath);
		}
		return speechFiles;
	}

	private async captureSpeechReviewFile(event: SandboxEvent): Promise<string | undefined> {
		const text = String(event.payload?.text ?? '');
		if (!text.trim()) return undefined;
		const filePath = await this.nextAudioPath('scripted-stt', 'wav');
		const aiffPath = `${filePath}.aiff`;
		await execFileAsync(MACOS_SAY_PATH, ['-o', aiffPath, text], { timeout: 15_000 });
		await execFileAsync(AFCONVERT_PATH, [aiffPath, filePath, '-f', 'WAVE', '-d', 'LEI16@22050'], {
			timeout: 15_000
		});
		await rm(aiffPath, { force: true });
		this.audioFiles.push(filePath);
		this.add('stt:reviewAudio', {
			eventTime: event.time,
			file: filePath,
			mimeType: 'audio/wav',
			source: 'scripted-stt',
			text
		});
		return filePath;
	}
}

async function canUseMacSpeechReview(): Promise<boolean> {
	try {
		await access(MACOS_SAY_PATH);
		await access(AFCONVERT_PATH);
		return true;
	} catch {
		return false;
	}
}

function safeName(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 80);
}

function extensionFromMime(mimeType?: string): string {
	if (!mimeType) return 'bin';
	const subtype = mimeType.split('/')[1]?.split(';')[0]?.trim();
	if (!subtype) return 'bin';
	if (subtype === 'mpeg') return 'mp3';
	return extname(`file.${subtype}`).slice(1) || subtype;
}
