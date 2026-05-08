import { spawn, type ChildProcess } from 'node:child_process';
import { waitFor } from '../utils/waitFor';

export class TargetProcessAdapter {
	private serverProcess: ChildProcess | null = null;

	async start(command?: string, cwd?: string, attach?: boolean): Promise<void> {
		if (attach || !command) return;
		this.serverProcess = spawn(command, { cwd, shell: true, stdio: 'ignore' });
		this.serverProcess.unref();
	}

	async waitForReady(url: string, timeoutMs: number): Promise<void> {
		await waitFor(
			async () => {
				try {
					const response = await fetch(url);
					return response.ok || response.status < 500;
				} catch {
					return false;
				}
			},
			`target app was not ready at ${url}`,
			timeoutMs
		);
	}

	stop(): void {
		if (!this.serverProcess) return;
		this.serverProcess.kill();
		this.serverProcess = null;
	}
}
