/**
 * RFC 4180 CSV serialiser for a participant projection (SC-FR-EXR-4).
 *
 * Pure: takes the semantic `ExportRow[]` (from `domain/projection`) and emits
 * the exact eight-column CSV the spec mandates. No DOM, no Blob — file
 * delivery (SC-FR-EXR-6) is the UI layer's job.
 *
 * RFC 4180 specifics applied here:
 *  - records separated by CRLF, file terminated with a final CRLF;
 *  - a field is double-quoted iff it contains a comma, double quote, CR or LF;
 *  - embedded double quotes are doubled.
 */
import { formatMoney } from '$lib/domain';
import type { ExportRow } from '$lib/domain';

/**
 * The MVP is single-currency (SC-FR-EXP-2); the ledger has no currency field
 * and adding one would be a deliberate file-format change (out of MVP scope).
 * Centralised here so a future per-ledger currency has one call site.
 */
export const LEDGER_CURRENCY = 'EUR';

export const CSV_HEADER = [
	'Date',
	'Description',
	'Amount',
	'Currency',
	'Counterparty',
	'Labels',
	'Note',
	'ExpenseUUID'
] as const;

const CRLF = '\r\n';

/** RFC 4180 field quoting. */
export function csvField(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Notes may contain CR/LF; SC-FR-EXR-4 col. 7 flattens them to single spaces
 *  (so a note is one CSV line rather than a quoted multi-line field). */
function flattenNote(note: string | undefined): string {
	return (note ?? '').replace(/[\r\n]+/g, ' ');
}

function row(r: ExportRow, currency: string): string {
	return [
		r.date,
		r.description,
		formatMoney(r.amount), // signed, 2 fractional digits, '.' separator
		currency,
		r.counterparties.join(', '),
		r.labels.join(';'),
		flattenNote(r.note),
		r.sourceId
	]
		.map((v) => csvField(String(v)))
		.join(',');
}

/** Serialise a projection to an RFC-4180 CSV string (UTF-8 when encoded). */
export function toCsv(rows: ExportRow[], currency: string = LEDGER_CURRENCY): string {
	const lines = [CSV_HEADER.join(','), ...rows.map((r) => row(r, currency))];
	return lines.join(CRLF) + CRLF;
}
