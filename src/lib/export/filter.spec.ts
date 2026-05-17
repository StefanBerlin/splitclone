import { describe, it, expect } from 'vitest';
import { applyExportFilter } from './filter';
import type { ExportRow } from '$lib/domain';

const r = (over: Partial<ExportRow>): ExportRow => ({
	date: '2026-05-10',
	description: 'x',
	amount: 0n,
	counterparties: [],
	labels: [],
	note: undefined,
	sourceId: 'id',
	...over
});

describe('applyExportFilter (SC-FR-EXR-5)', () => {
	const rows = [
		r({ sourceId: 'a', date: '2026-04-30', labels: ['food'] }),
		r({ sourceId: 'b', date: '2026-05-10', labels: ['travel'] }),
		r({ sourceId: 'c', date: '2026-05-20', labels: [] }) // settlement-like
	];

	it('passes everything through with an empty filter', () => {
		expect(applyExportFilter(rows, { from: '', to: '', labels: [] })).toHaveLength(3);
	});

	it('applies an inclusive date range', () => {
		const out = applyExportFilter(rows, { from: '2026-05-01', to: '2026-05-15', labels: [] });
		expect(out.map((x) => x.sourceId)).toEqual(['b']);
	});

	it('filters by label name and excludes label-less rows when labels are set', () => {
		const out = applyExportFilter(rows, { from: '', to: '', labels: ['food', 'travel'] });
		expect(out.map((x) => x.sourceId)).toEqual(['a', 'b']);
	});

	it('combines date and label predicates', () => {
		const out = applyExportFilter(rows, { from: '2026-05-01', to: '', labels: ['travel'] });
		expect(out.map((x) => x.sourceId)).toEqual(['b']);
	});
});
