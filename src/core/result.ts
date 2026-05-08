import type { EventRecorder } from './EventRecorder';
import type { SandboxRunResult } from './types';

interface ResultInput {
	artifactDir: string;
	eventsFile: string;
	recorder: EventRecorder;
	reviewFile?: string;
	scenario: string;
	screenshotFile: string;
	traceFile: string;
	videoFiles: string[];
}

export function createRunResult(input: ResultInput): SandboxRunResult {
	return {
		artifactsDir: input.artifactDir,
		audioFiles: input.recorder.getAudioFiles(),
		eventsFile: input.eventsFile,
		reviewFile: input.reviewFile,
		scenario: input.scenario,
		screenshotFile: input.screenshotFile,
		traceFile: input.traceFile,
		videoFiles: input.videoFiles
	};
}
