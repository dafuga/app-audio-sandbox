export function assertEqual<T>(actual: T, expected: T, message: string): void {
	if (Object.is(actual, expected)) return;
	throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
}
