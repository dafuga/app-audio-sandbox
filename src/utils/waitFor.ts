export async function waitFor(
	check: () => Promise<boolean> | boolean,
	message: string,
	timeoutMs = 5000
): Promise<void> {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (await check()) return;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	throw new Error(message);
}
