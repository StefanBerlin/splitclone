import type { ISODate, Money, UUID } from '../types';

export type ExportMode = 'cash' | 'virtual';

/**
 * One semantic export line. CSV string formatting (RFC 4180, column order,
 * quoting) is a separate concern handled by the export layer in a later phase
 * (SC-FR-EXR-4); this is just the data.
 *
 * Sign convention (both modes): amount > 0 is an inflow to the subject
 * participant, amount < 0 is an outflow (SC-FR-EXR-3).
 */
export interface ExportRow {
	date: ISODate;
	description: string;
	amount: Money;
	counterparties: string[];
	labels: string[];
	note?: string;
	sourceId: UUID;
}
