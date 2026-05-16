/**
 * Money helpers. Money is a bigint in minor units (cents for 2-digit
 * currencies). All functions are pure and total; parsing is strict — it is
 * the UI's job to pre-validate user input, so anything malformed here is a
 * programming error and throws.
 */
import type { Money } from './types';

export const DEFAULT_MINOR_DIGITS = 2;

/** Parse a decimal string ("47.20", "-5", ".5") into minor units. */
export function parseMoney(input: string, minorDigits = DEFAULT_MINOR_DIGITS): Money {
	const m = /^(-)?(\d*)(?:\.(\d+))?$/.exec(input.trim());
	if (!m || (m[2] === '' && m[3] === undefined)) {
		throw new Error(`Not a valid money string: ${JSON.stringify(input)}`);
	}
	const negative = m[1] === '-';
	const intPart = m[2] ?? '';
	const fracPart = m[3] ?? '';
	if (fracPart.length > minorDigits) {
		throw new Error(
			`Too many fractional digits for ${minorDigits}-minor-digit currency: ${JSON.stringify(input)}`
		);
	}
	const padded = fracPart.padEnd(minorDigits, '0');
	const magnitude = BigInt((intPart === '' ? '0' : intPart) + padded);
	return negative ? -magnitude : magnitude;
}

/** Format minor units back to a fixed-precision decimal string ("4720" -> "47.20"). */
export function formatMoney(value: Money, minorDigits = DEFAULT_MINOR_DIGITS): string {
	const negative = value < 0n;
	const digits = (negative ? -value : value).toString().padStart(minorDigits + 1, '0');
	const cut = digits.length - minorDigits;
	const intPart = digits.slice(0, cut);
	const fracPart = digits.slice(cut);
	const body = minorDigits === 0 ? intPart : `${intPart}.${fracPart}`;
	return negative ? `-${body}` : body;
}

export function absMoney(value: Money): Money {
	return value < 0n ? -value : value;
}

export function sumMoney(values: Iterable<Money>): Money {
	let total = 0n;
	for (const v of values) total += v;
	return total;
}
