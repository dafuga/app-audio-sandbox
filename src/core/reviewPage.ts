import { relative, sep } from 'node:path';
import type { SandboxEvent } from './types';

interface ReviewItem {
	atMs: number;
	file?: string;
	kind: 'app-audio' | 'scripted-stt' | 'stop';
	label: string;
	text?: string;
}

export function createReviewHtml(
	events: SandboxEvent[],
	artifactDir: string,
	speechFiles: Map<SandboxEvent, string>
): string | undefined {
	const items = reviewItems(events, artifactDir, speechFiles);
	if (items.length === 0) return undefined;
	return reviewHtml(items);
}

function reviewItems(
	events: SandboxEvent[],
	artifactDir: string,
	speechFiles: Map<SandboxEvent, string>
): ReviewItem[] {
	const start = firstEventTime(events);
	if (!start) return [];
	return events.flatMap((event) => reviewItem(event, start, artifactDir, speechFiles));
}

function reviewItem(
	event: SandboxEvent,
	start: number,
	artifactDir: string,
	speechFiles: Map<SandboxEvent, string>
): ReviewItem[] {
	const atMs = Math.max(0, Date.parse(event.time) - start);
	if (event.type === 'audio:capture' && event.payload?.source === 'nativeAudio') {
		return [audioReviewItem(event, atMs, artifactDir)];
	}
	if (event.type === 'stt:result') {
		return [speechReviewItem(event, atMs, artifactDir, speechFiles.get(event))];
	}
	if (event.type === 'nativeAudio:stopVoicePlayback') {
		return [{ atMs, kind: 'stop', label: 'Stop app voice playback' }];
	}
	return [];
}

function audioReviewItem(event: SandboxEvent, atMs: number, artifactDir: string): ReviewItem {
	return {
		atMs,
		file: relativeFile(artifactDir, event.payload?.file),
		kind: 'app-audio',
		label: 'AI voice playback'
	};
}

function speechReviewItem(
	event: SandboxEvent,
	atMs: number,
	artifactDir: string,
	file?: string
): ReviewItem {
	const text = String(event.payload?.text ?? '');
	return {
		atMs,
		file: relativeFile(artifactDir, file),
		kind: 'scripted-stt',
		label: `Scripted user speech: ${text}`,
		text
	};
}

function firstEventTime(events: SandboxEvent[]): number | undefined {
	const first = events[0]?.time;
	return first ? Date.parse(first) : undefined;
}

function relativeFile(artifactDir: string, file: unknown): string | undefined {
	if (typeof file !== 'string') return undefined;
	return relative(artifactDir, file).split(sep).join('/');
}

function reviewHtml(items: ReviewItem[]): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>App Audio Sandbox Review</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;margin:40px;background:#f7faf8;color:#101828}
button{font:inherit;padding:12px 18px;border-radius:8px;border:1px solid #cfd7d4;background:#146b4a;color:white}
ol{margin-top:24px;line-height:1.7}
.card{max-width:760px;background:white;border:1px solid #dce5e1;border-radius:10px;padding:24px;box-shadow:0 8px 28px #15261d14}
</style>
</head>
<body>
<main class="card">
<h1>Voice Cutoff Review</h1>
<p>Plays the captured app voice, the scripted user interruption, and the stop event on the same timeline.</p>
<button id="play">Play review timeline</button>
<ol id="log"></ol>
</main>
<script>
const items = ${JSON.stringify(items)};
const activeAppAudio = new Set();
const log = (text) => {
  const item = document.createElement('li');
  item.textContent = text;
  document.getElementById('log').appendChild(item);
};
document.getElementById('play').addEventListener('click', () => {
  document.getElementById('log').textContent = '';
  for (const item of items) setTimeout(() => playItem(item), item.atMs);
});
function playItem(item) {
  if (item.kind === 'stop') {
    for (const audio of activeAppAudio) audio.pause();
    activeAppAudio.clear();
    log(item.label + ' at ' + item.atMs + 'ms');
    return;
  }
  if (!item.file) {
    log(item.label + ' at ' + item.atMs + 'ms (no review audio file)');
    return;
  }
  const audio = new Audio(item.file);
  if (item.kind === 'app-audio') activeAppAudio.add(audio);
  audio.play().catch((error) => log('Playback failed: ' + error.message));
  log(item.label + ' at ' + item.atMs + 'ms');
}
</script>
</body>
</html>`;
}
