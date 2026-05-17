import { describe, it, expect } from 'vitest';
import { parseMoney, formatMoney, absMoney, sumMoney } from './money';

describe('parseMoney', () => {
	it('parses whole and fractional amounts to minor units', () => {
		expect(parseMoney('47.20')).toBe(4720n);
		expect(parseMoney('47')).toBe(4700n);
		expect(parseMoney('47.2')).toBe(4720n);
		expect(parseMoney('.5')).toBe(50n);
		expect(parseMoney('0')).toBe(0n);
	});

	it('parses negatives', () => {
		expect(parseMoney('-5.00')).toBe(-500n);
		expect(parseMoney('-0.01')).toBe(-1n);
	});

	it('rejects over-precise or malformed input rather than rounding', () => {
		expect(() => parseMoney('47.205')).toThrow();
		expect(() => parseMoney('abc')).toThrow();
		expect(() => parseMoney('')).toThrow();
		expect(() => parseMoney('1,000.00')).toThrow();
	});

	it('honours non-default minor digits (e.g. 0 for JPY-like)', () => {
		expect(parseMoney('1500', 0)).toBe(1500n);
		expect(() => parseMoney('15.0', 0)).toThrow();
	});
});

describe('formatMoney', () => {
	it('is the inverse of parseMoney for fixed precision', () => {
		for (const s of ['47.20', '0.00', '-5.00', '1000.05', '0.01']) {
			expect(formatMoney(parseMoney(s))).toBe(s);
		}
	});

	it('pads small magnitudes correctly', () => {
		expect(formatMoney(5n)).toBe('0.05');
		expect(formatMoney(-5n)).toBe('-0.05');
		expect(formatMoney(0n)).toBe('0.00');
	});
});

describe('absMoney / sumMoney', () => {
	it('absMoney', () => {
		expect(absMoney(-500n)).toBe(500n);
		expect(absMoney(500n)).toBe(500n);
	});
	it('sumMoney', () => {
		expect(sumMoney([100n, 200n, -50n])).toBe(250n);
		expect(sumMoney([])).toBe(0n);
	});
});
