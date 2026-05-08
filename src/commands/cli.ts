#!/usr/bin/env node
import { Command } from 'commander';
import { listScenarios } from '../core/scenarios';
import type { SandboxBrowser, SandboxRunOptions } from '../core/types';
import { RunScenarioCommand } from './RunScenarioCommand';

const program = new Command();

program
	.name('app-audio-sandbox')
	.description('Run app voice and audio flows through a muted Playwright sandbox.')
	.version('0.1.0');

program
	.command('run')
	.description('Run a sandbox scenario.')
	.requiredOption('--scenario <name>', 'scenario name')
	.option('--url <url>', 'target URL override')
	.option('--app-cwd <path>', 'target app working directory')
	.option('--app-command <command>', 'target app command')
	.option('--attach', 'attach to an already running app')
	.option('--out-dir <path>', 'artifact output directory')
	.option('--browser <name>', 'chromium, firefox, or webkit', 'chromium')
	.option('--headed', 'show the browser window')
	.option('--record-audio', 'capture audio artifacts without speaker playback')
	.option('--real-tts', 'use the target app TTS endpoint instead of mocked audio')
	.option('--audible', 'allow sound to play through speakers')
	.option('--timeout-ms <ms>', 'target readiness timeout in milliseconds', parseNumber)
	.action(async (rawOptions) => {
		const result = await new RunScenarioCommand().run(normalizeOptions(rawOptions));
		console.log(JSON.stringify(result, null, 2));
	});

program
	.command('list')
	.description('List built-in scenarios.')
	.action(() => {
		for (const scenario of listScenarios()) console.log(scenario);
	});

await program.parseAsync(process.argv);

function normalizeOptions(rawOptions: Record<string, unknown>): SandboxRunOptions {
	return {
		appCommand: stringOption(rawOptions.appCommand),
		appCwd: stringOption(rawOptions.appCwd),
		attach: Boolean(rawOptions.attach),
		audible: Boolean(rawOptions.audible),
		browser: browserOption(rawOptions.browser),
		headed: Boolean(rawOptions.headed),
		outDir: stringOption(rawOptions.outDir),
		recordAudio: Boolean(rawOptions.recordAudio),
		realTts: Boolean(rawOptions.realTts),
		scenario: String(rawOptions.scenario),
		timeoutMs: numberOption(rawOptions.timeoutMs),
		url: stringOption(rawOptions.url)
	};
}

function browserOption(value: unknown): SandboxBrowser {
	if (value === 'firefox' || value === 'webkit') return value;
	return 'chromium';
}

function stringOption(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberOption(value: unknown): number | undefined {
	return typeof value === 'number' ? value : undefined;
}

function parseNumber(value: string): number {
	return Number(value);
}
