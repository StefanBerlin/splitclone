/**
 * Apply the UI's active history filter to a projection before CSV export
 * (SC-FR-EXR-5: an export honours the execution-date range + label filter
 * active at the moment it is initiated).
 *
 * Pure. Label matching is by display name (the caller resolves selected
 * label ids → names via the ledger) so this stays domain-agnostic. As in the
 * expense list, a non-empty label filter excludes rows with no labels (i.e.
 * settlement rows), since settlements carry no labels.
 */
import type { ExportRow } from '$lib/domain';

export interface ExportFilter {
	/** Inclusive lower bound on the row date (YYYY-MM-DD); '' = unbounded. */
	from: string;
	/** Inclusive upper bound on the row date; '' = unbounded. */
	to: string;
	/** Selected label display names; [] = no label filter. */
	labels: string[];
}

export function applyExportFilter(rows: ExportRow[], f: ExportFilter): ExportRow[] {
	const labelSet = new Set(f.labels);
	return rows.filter((r) => {
		if (f.from && r.date < f.from) return false;
		if (f.to && r.date > f.to) return false;
		if (labelSet.size > 0 && !r.labels.some((l) => labelSet.has(l))) return false;
		return true;
	});
}
