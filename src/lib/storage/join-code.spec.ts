import { describe, expect, it } from 'vitest';
import { decodeJoinCode, encodeJoinCode } from './join-code';

function key(fill: number): Uint8Array {
	return new Uint8Array(32).fill(fill);
}

describe('join code (SC-ARC-ENC-4)', () => {
	it('round-trips the raw key', async () => {
		const raw = crypto.getRandomValues(new Uint8Array(32));
		const code = await encodeJoinCode(raw);
		const decoded = await decodeJoinCode(code);
		expect(decoded.ok).toBe(true);
		expect(Buffer.from(decoded.raw!)).toEqual(Buffer.from(raw));
	});

	it('has the SC1 prefix and three dot-separated parts', async () => {
		const code = await encodeJoinCode(key(3));
		const parts = code.split('.');
		expect(parts[0]).toBe('SC1');
		expect(parts).toHaveLength(3);
	});

	it('tolerates surrounding whitespace', async () => {
		const code = await encodeJoinCode(key(5));
		expect((await decodeJoinCode(`  \n${code}\t `)).ok).toBe(true);
	});

	it('rejects a one-character transcription typo via the checksum', async () => {
		const code = await encodeJoinCode(key(8));
		const i = 6; // inside the base64url body
		const swap = code[i] === 'A' ? 'B' : 'A';
		const typo = code.slice(0, i) + swap + code.slice(i + 1);
		const decoded = await decodeJoinCode(typo);
		expect(decoded.ok).toBe(false);
		expect(decoded.error).toMatch(/checksum/i);
	});

	it('rejects a non-SplitClone string', async () => {
		expect((await decodeJoinCode('hello world')).ok).toBe(false);
		expect((await decodeJoinCode('SC1.zzz')).ok).toBe(false);
	});

	it('throws when encoding a wrong-length key', async () => {
		await expect(encodeJoinCode(new Uint8Array(16))).rejects.toThrow();
	});
});
