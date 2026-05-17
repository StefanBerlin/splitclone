import { describe, expect, it } from 'vitest';
import {
	dataKeyFingerprint,
	generateDataKey,
	importDataKey,
	openSegment,
	sealSegment
} from './encryption';

const enc = new TextEncoder();
const dec = new TextDecoder();

describe('encryption codec (SC-ARC-ENC-2)', () => {
	it('round-trips plaintext through seal/open', async () => {
		const { key } = await generateDataKey();
		const plain = enc.encode('{"kind":"ExpenseAdded"}\n{"kind":"SettlementAdded"}\n');
		const sealed = await sealSegment(plain, key);
		expect(dec.decode(await openSegment(sealed, key))).toBe(dec.decode(plain));
	});

	it('prepends a 12-byte IV and appends a 16-byte tag', async () => {
		const { key } = await generateDataKey();
		const plain = enc.encode('abc');
		const sealed = await sealSegment(plain, key);
		expect(sealed.length).toBe(12 + plain.length + 16);
	});

	it('uses a fresh IV every call (same plaintext → different ciphertext)', async () => {
		const { key } = await generateDataKey();
		const plain = enc.encode('same input');
		const a = await sealSegment(plain, key);
		const b = await sealSegment(plain, key);
		expect(Buffer.from(a)).not.toEqual(Buffer.from(b));
	});

	it('throws loudly on a tampered tag/ciphertext', async () => {
		const { key } = await generateDataKey();
		const sealed = await sealSegment(enc.encode('payload'), key);
		const i = sealed.length - 1;
		sealed[i] = (sealed[i] ?? 0) ^ 0xff;
		await expect(openSegment(sealed, key)).rejects.toThrow();
	});

	it('throws when opened with the wrong key', async () => {
		const a = await generateDataKey();
		const b = await generateDataKey();
		const sealed = await sealSegment(enc.encode('payload'), a.key);
		await expect(openSegment(sealed, b.key)).rejects.toThrow();
	});
});

describe('data key handling (SC-ARC-ENC-3, SC-ARC-ENC-5)', () => {
	it('fingerprint is 32 lowercase hex chars and deterministic', async () => {
		const raw = new Uint8Array(32).fill(7);
		const fp1 = await dataKeyFingerprint(raw);
		const fp2 = await dataKeyFingerprint(raw);
		expect(fp1).toMatch(/^[0-9a-f]{32}$/);
		expect(fp1).toBe(fp2);
	});

	it('fingerprint differs for different keys', async () => {
		const fpA = await dataKeyFingerprint(new Uint8Array(32).fill(1));
		const fpB = await dataKeyFingerprint(new Uint8Array(32).fill(2));
		expect(fpA).not.toBe(fpB);
	});

	it('imported keys are non-extractable', async () => {
		const key = await importDataKey(new Uint8Array(32).fill(9));
		await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
	});
});
