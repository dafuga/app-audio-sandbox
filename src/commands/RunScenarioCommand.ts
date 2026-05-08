import { PlaywrightRunnerAdapter } from '../adapters/PlaywrightRunnerAdapter';
import { getScenario } from '../core/scenarios';
import type { SandboxRunOptions, SandboxRunResult } from '../core/types';

export class RunScenarioCommand {
	constructor(private readonly runner = new PlaywrightRunnerAdapter()) {}

	async run(options: SandboxRunOptions): Promise<SandboxRunResult> {
		const scenario = getScenario(options.scenario);
		return this.runner.run(scenario, options);
	}
}
