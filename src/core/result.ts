import type { EventRecorder } from './EventRecorder';
import type { SandboxRunResult } from './types';

interface ResultInput {
	artifactDir: string;
	eventsFile: string;
	recorder: EventRecorder;
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
		scenario: input.scenario,
		screenshotFile: input.screenshotFile,
		traceFile: input.traceFile,
		videoFiles: input.videoFiles
	};
}
