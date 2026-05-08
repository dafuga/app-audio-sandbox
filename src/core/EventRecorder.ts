import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { AudioCapture, SandboxEvent } from './types';

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
