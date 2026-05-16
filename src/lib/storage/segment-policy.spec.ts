import { describe, it, expect } from 'vitest';
import { shouldRotate, newSegmentName, byteLength, SEGMENT_THRESHOLD } from './segment-policy';

describe('shouldRotate (SC-ARC-LOG-4)', () => {
	it('never rotates an empty segment, even for an oversized event', () => {
		expect(shouldRotate(0, SEGMENT_THRESHOLD * 5, SEGMENT_THRESHOLD)).toBe(false);
	});

	it('rotates when the write would exceed the threshold', () => {
		expect(shouldRotate(4000, 200, 4096)).toBe(true);
		expect(shouldRotate(4000, 96, 4096)).toBe(false); // exactly at limit
		expect(shouldRotate(4000, 97, 4096)).toBe(true); // one over
	});
});

describe('newSegmentName (SC-ARC-LOG-4 — lexicographic == chronological)', () => {
	it('formats a UTC instant as YYYYMMDDTHHMMSSsss', () => {
		const d = new Date(Date.UTC(2026, 4, 14, 9, 3, 7, 42));
		expect(newSegmentName(d)).toBe('20260514T090307042');
	});

	it('sorts chronologically as plain strings', () => {
		const a = newSegmentName(new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0)));
		const b = newSegmentName(new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 1)));
		const c = newSegmentName(new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999)));
		expect([c, a, b].sort()).toEqual([a, b, c]);
	});
});

describe('byteLength', () => {
	it('counts UTF-8 bytes, not code units', () => {
		expect(byteLength('abc')).toBe(3);
		expect(byteLength('€')).toBe(3); // 3-byte UTF-8
		expect(byteLength('🙂')).toBe(4);
	});
});
