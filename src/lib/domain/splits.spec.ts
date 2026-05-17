import { describe, it, expect } from 'vitest';
import { splitEqually, shareOf } from './splits';
import { sumMoney } from './money';

describe('splitEqually (SC-FR-SPL-1)', () => {
	it('divides evenly when it can', () => {
		const shares = splitEqually({
			amount: 3000n,
			splitParticipantIds: ['a', 'b', 'c'],
			payerId: 'a'
		});
		expect([...shares.values()]).toEqual([1000n, 1000n, 1000n]);
	});

	it('single participant owes the whole amount', () => {
		const shares = splitEqually({
			amount: 4720n,
			splitParticipantIds: ['solo'],
			payerId: 'solo'
		});
		expect(shares.get('solo')).toBe(4720n);
	});
});

describe('rounding remainder goes to the payer (SC-FR-SPL-2)', () => {
	it('the worked example from mockup 04: €47.20 / 3, Anna pays', () => {
		const shares = splitEqually({
			amount: 4720n,
			splitParticipantIds: ['anna', 'stefan', 'lukas'],
			payerId: 'anna'
		});
		expect(shares.get('anna')).toBe(1574n); // base 1573 + remainder 1
		expect(shares.get('stefan')).toBe(1573n);
		expect(shares.get('lukas')).toBe(1573n);
	});

	it('shares always sum to exactly the amount', () => {
		for (const amount of [4720n, 1n, 99999n, 100n, 7n]) {
			const shares = splitEqually({
				amount,
				splitParticipantIds: ['a', 'b', 'c', 'd'],
				payerId: 'b'
			});
			expect(sumMoney(shares.values())).toBe(amount);
		}
	});

	it('result is independent of split-list order', () => {
		const a = splitEqually({ amount: 100n, splitParticipantIds: ['x', 'y', 'z'], payerId: 'y' });
		const b = splitEqually({ amount: 100n, splitParticipantIds: ['z', 'x', 'y'], payerId: 'y' });
		expect(a.get('y')).toBe(b.get('y'));
		expect(a.get('x')).toBe(b.get('x'));
	});
});

describe('payer excluded from the split (SC-FR-SPL-3)', () => {
	it('payer not in split: remainder falls to the lexicographically first member', () => {
		const shares = splitEqually({
			amount: 100n,
			splitParticipantIds: ['m', 'k'], // k sorts first
			payerId: 'payer-not-in-split'
		});
		// 100 / 2 = 50 exactly, no remainder
		expect(shares.get('k')).toBe(50n);
		expect(shares.get('m')).toBe(50n);

		const odd = splitEqually({
			amount: 101n,
			splitParticipantIds: ['m', 'k'],
			payerId: 'payer-not-in-split'
		});
		expect(odd.get('k')).toBe(51n); // 50 + remainder 1
		expect(odd.get('m')).toBe(50n);
		expect(sumMoney(odd.values())).toBe(101n);
	});
});

describe('invariants', () => {
	it('rejects non-positive amounts and empty/duplicate splits', () => {
		expect(() => splitEqually({ amount: 0n, splitParticipantIds: ['a'], payerId: 'a' })).toThrow();
		expect(() => splitEqually({ amount: -1n, splitParticipantIds: ['a'], payerId: 'a' })).toThrow();
		expect(() => splitEqually({ amount: 10n, splitParticipantIds: [], payerId: 'a' })).toThrow();
		expect(() =>
			splitEqually({ amount: 10n, splitParticipantIds: ['a', 'a'], payerId: 'a' })
		).toThrow();
	});

	it('shareOf returns 0 for a non-participant', () => {
		const input = { amount: 90n, splitParticipantIds: ['a', 'b', 'c'], payerId: 'a' };
		expect(shareOf(input, 'b')).toBe(30n);
		expect(shareOf(input, 'zzz')).toBe(0n);
	});
});
