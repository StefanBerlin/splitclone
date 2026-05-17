import { describe, expect, it } from 'vitest';
import { buildMetadata, encodeMetadata, parseMetadata } from './metadata';

describe('ledger metadata (SC-FR-LED-3, SC-ARC-ENC-3)', () => {
	it('builds minimal, non-sensitive metadata', () => {
		const m = buildMetadata('led-abc', 'deadbeef'.repeat(4));
		expect(m.ledgerId).toBe('led-abc');
		expect(m.encrypted).toBe(true);
		expect(m.schemaVersion).toBe(1);
		// No ledger name / participants / labels leak into plaintext.
		expect(Object.keys(m).sort()).toEqual([
			'createdAt',
			'encrypted',
			'keyFingerprint',
			'ledgerId',
			'schemaVersion'
		]);
	});

	it('round-trips through encode/parse', () => {
		const m = buildMetadata('led-xyz', 'a'.repeat(32));
		expect(parseMetadata(encodeMetadata(m))).toEqual(m);
	});

	it('rejects a non-SplitClone / unencrypted file', () => {
		expect(() => parseMetadata(new TextEncoder().encode('{"hello":1}'))).toThrow();
		expect(() =>
			parseMetadata(
				new TextEncoder().encode('{"ledgerId":"x","keyFingerprint":"y","encrypted":false}')
			)
		).toThrow();
	});
});
