import { describe, it, expect } from 'vitest';
import { APP_VERSION, SCHEMA_VERSION } from './meta';

describe('build metadata', () => {
	it('exposes a semver-ish app version', () => {
		expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it('schema version is a positive integer (SC-ARC-FMT-1)', () => {
		expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
		expect(SCHEMA_VERSION).toBeGreaterThan(0);
	});
});
