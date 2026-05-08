import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export async function createArtifactDir(
	baseDir: string | undefined,
	scenario: string
): Promise<string> {
	const root = resolve(baseDir ?? join(homedir(), 'Desktop', 'app-audio-sandbox-artifacts'));
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const dir = join(root, `${scenario}-${stamp}`);
	await mkdir(join(dir, 'videos'), { recursive: true });
	return dir;
}

export function normalizeTimeout(value?: number): number {
	return value && value > 0 ? value : 60_000;
}
