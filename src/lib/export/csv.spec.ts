import { describe, it, expect } from 'vitest';
import { toCsv, csvField, CSV_HEADER, LEDGER_CURRENCY } from './csv';
import type { ExportRow } from '$lib/domain';

const base: ExportRow = {
	date: '2026-05-10',
	description: 'Dinner',
	amount: -1234n,
	counterparties: ['Anna', 'Bo'],
	labels: ['food'],
	note: 'tip included',
	sourceId: 'e-1'
};

describe('csvField — RFC 4180 quoting (SC-FR-EXR-4)', () => {
	it('leaves plain values unquoted', () => {
		expect(csvField('Dinner')).toBe('Dinner');
	});
	it('quotes and doubles internal double-quotes', () => {
		expect(csvField('say "hi"')).toBe('"say ""hi"""');
	});
	it('quotes on comma, CR and LF', () => {
		expect(csvField('a,b')).toBe('"a,b"');
		expect(csvField('a\nb')).toBe('"a\nb"');
		expect(csvField('a\r\nb')).toBe('"a\r\nb"');
	});
});

describe('toCsv (SC-FR-EXR-4)', () => {
	it('emits the exact 8-column header, CRLF-separated, trailing CRLF', () => {
		const out = toCsv([]);
		expect(out).toBe('Date,Description,Amount,Currency,Counterparty,Labels,Note,ExpenseUUID\r\n');
		expect(CSV_HEADER.length).toBe(8);
	});

	it('formats a row: signed 2dp amount, EUR, ", " counterparties, ; labels', () => {
		const [, line] = toCsv([base]).split('\r\n');
		expect(line).toBe('2026-05-10,Dinner,-12.34,EUR,"Anna, Bo",food,tip included,e-1');
		expect(LEDGER_CURRENCY).toBe('EUR');
	});

	it('quotes a counterparty list (contains a comma) and a comma-bearing title', () => {
		const out = toCsv([{ ...base, description: 'Taxi, late' }]);
		expect(out.split('\r\n')[1]).toContain('"Taxi, late"');
		expect(out.split('\r\n')[1]).toContain('"Anna, Bo"');
	});

	it('flattens CR/LF in the note to single spaces (col. 7)', () => {
		const out = toCsv([{ ...base, note: 'line1\r\nline2\nline3' }]);
		expect(out.split('\r\n')[1]).toContain(',line1 line2 line3,');
	});

	it('emits empty Labels/Note for settlement-style rows', () => {
		const out = toCsv([
			{
				...base,
				description: 'Settlement to Bo',
				labels: [],
				note: undefined,
				counterparties: ['Bo']
			}
		]);
		expect(out.split('\r\n')[1]).toBe('2026-05-10,Settlement to Bo,-12.34,EUR,Bo,,,e-1');
	});

	it('round-trips a positive amount with two fractional digits', () => {
		expect(toCsv([{ ...base, amount: 500n }]).split('\r\n')[1]).toContain(',5.00,');
		expect(toCsv([{ ...base, amount: 0n }]).split('\r\n')[1]).toContain(',0.00,');
	});
});
