import type { SandboxScenario } from './types';
import { createFluoraScenario } from './fluoraScenario';
import { createNudgeScenario } from './nudgeScenario';

const NUDGE_SCENARIOS = [
	'nudge-voice-cutoff',
	'nudge-echo-filter',
	'nudge-native-tts-routing',
	'nudge-stt-warmup'
];
const FLUORA_SCENARIOS = ['fluora-voice-cutoff', 'fluora-echo-filter', 'fluora-stt-warmup'];

export function getScenario(name: string): SandboxScenario {
	if (FLUORA_SCENARIOS.includes(name)) return createFluoraScenario(name);
	if (NUDGE_SCENARIOS.includes(name)) return createNudgeScenario(name);
	throw new Error(`Unknown scenario "${name}". Available scenarios: ${listScenarios().join(', ')}`);
}

export function listScenarios(): string[] {
	return [...NUDGE_SCENARIOS, ...FLUORA_SCENARIOS];
}
