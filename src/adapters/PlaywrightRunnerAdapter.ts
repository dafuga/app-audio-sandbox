import { join } from 'node:path';
import { chromium, firefox, webkit, type Browser, type Page } from 'playwright';
import { createBrowserInstrumentationScript } from './browserInstrumentation';
import { resolveMode, resolveTarget, sandboxConfig } from '../config/sandboxConfig';
import { createArtifactDir, normalizeTimeout } from '../core/artifacts';
import { EventRecorder } from '../core/EventRecorder';
import { createRunResult } from '../core/result';
import type {
	SandboxRunOptions,
	SandboxRunResult,
	SandboxScenario,
	ScenarioRuntime
} from '../core/types';
import { TargetProcessAdapter } from './TargetProcessAdapter';

export class PlaywrightRunnerAdapter {
	constructor(private readonly targetProcess = new TargetProcessAdapter()) {}

	async run(scenario: SandboxScenario, options: SandboxRunOptions): Promise<SandboxRunResult> {
		const artifactDir = await createArtifactDir(options.outDir, scenario.name);
		const recorder = new EventRecorder(artifactDir);
		const target = resolveTarget(scenario, options);
		await this.targetProcess.start(target.appCommand, target.appCwd, options.attach);
		await this.targetProcess.waitForReady(
			target.readyUrl ?? target.url,
			normalizeTimeout(options.timeoutMs)
		);
		const browser = await this.launchBrowser(options);
		try {
			return await this.runInBrowser({ artifactDir, browser, options, recorder, scenario });
		} finally {
			await browser.close();
			this.targetProcess.stop();
		}
	}

	private async runInBrowser(input: BrowserRunInput): Promise<SandboxRunResult> {
		const context = await input.browser.newContext({
			baseURL: new URL(resolveTarget(input.scenario, input.options).url).origin,
			permissions: ['microphone'],
			recordVideo: { dir: join(input.artifactDir, 'videos') }
		});
		await context.tracing.start({ screenshots: true, snapshots: true });
		const page = await context.newPage();
		await this.installBridge(page, input.recorder, input.options);
		const runtime = this.createRuntime(context, page, input.recorder, input.options);
		await input.scenario.setup?.(runtime);
		await page.goto(resolveTarget(input.scenario, input.options).url, {
			waitUntil: 'domcontentloaded'
		});
		await input.scenario.run(runtime);
		const screenshotFile = join(input.artifactDir, 'final.png');
		await page.screenshot({ path: screenshotFile, fullPage: true });
		const traceFile = join(input.artifactDir, 'trace.zip');
		const video = page.video();
		await context.tracing.stop({ path: traceFile });
		await context.close();
		const reviewFile = await input.recorder.writeReviewPage();
		const eventsFile = await input.recorder.writeEvents();
		const videoFiles = video ? [await video.path()] : [];
		return createRunResult({
			artifactDir: input.artifactDir,
			eventsFile,
			recorder: input.recorder,
			reviewFile,
			scenario: input.scenario.name,
			screenshotFile,
			traceFile,
			videoFiles
		});
	}

	private async installBridge(
		page: Page,
		recorder: EventRecorder,
		options: SandboxRunOptions
	): Promise<void> {
		await page.exposeFunction(
			'appAudioSandboxEmit',
			(event: { type: string; payload?: Record<string, unknown> }) => {
				recorder.add(event.type, event.payload);
			}
		);
		await page.exposeFunction('appAudioSandboxCaptureAudio', (capture: unknown) => {
			return recorder.captureAudio(capture as Parameters<EventRecorder['captureAudio']>[0]);
		});
		await page.addInitScript({
			content: createBrowserInstrumentationScript({
				loopbackAudioToMic: true,
				mode: resolveMode(options),
				nativeAudio: true,
				nativeDurationMs: 10_000
			})
		});
	}

	private createRuntime(
		context: ScenarioRuntime['context'],
		page: Page,
		recorder: EventRecorder,
		options: SandboxRunOptions
	): ScenarioRuntime {
		return {
			context,
			emit: (type, payload) => recorder.add(type, payload),
			mode: resolveMode(options),
			page,
			recordAudio: (capture) => void recorder.captureAudio(capture),
			recorder,
			realTts: options.realTts === true,
			routeJson: (route, body, status) =>
				route.fulfill({
					status: status ?? 200,
					contentType: 'application/json',
					body: JSON.stringify(body)
				})
		};
	}

	private async launchBrowser(options: SandboxRunOptions): Promise<Browser> {
		const browserName = options.browser ?? sandboxConfig.defaultBrowser;
		let browserType = chromium;
		if (browserName === 'firefox') browserType = firefox;
		if (browserName === 'webkit') browserType = webkit;
		const args = options.audible ? [] : ['--mute-audio'];
		return browserType.launch({ args, headless: !options.headed });
	}
}

interface BrowserRunInput {
	artifactDir: string;
	browser: Browser;
	options: SandboxRunOptions;
	recorder: EventRecorder;
	scenario: SandboxScenario;
}
