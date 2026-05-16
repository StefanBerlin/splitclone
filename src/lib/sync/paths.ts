/**
 * Pure helpers for the in-folder layout of one ledger (SC-ARC-LOG-4). All
 * paths are RELATIVE TO THE LEDGER FOLDER, because the provider is rooted at
 * that folder (the owner's `Apps/SplitClone/<ledgerId>/`, or the same folder
 * as it appears under a joiner's "shared with me"). Kept env-free so it is
 * unit-testable.
 *
 *   ledger.json                                  (plaintext metadata)
 *   events/<deviceId>/<segmentName>.jsonl.enc    (sealed segment)
 */
const SEG_SUFFIX = '.jsonl.enc';

export const METADATA_PATH = 'ledger.json';
export const EVENTS_ROOT = 'events';

export function deviceFolder(deviceId: string): string {
	return `${EVENTS_ROOT}/${deviceId}`;
}

export function segmentPath(deviceId: string, segmentName: string): string {
	return `${deviceFolder(deviceId)}/${segmentName}${SEG_SUFFIX}`;
}

export function isSegmentFile(name: string): boolean {
	return name.endsWith(SEG_SUFFIX) && name.length > SEG_SUFFIX.length;
}

export function segmentNameFromFile(fileName: string): string {
	return fileName.slice(0, -SEG_SUFFIX.length);
}

/**
 * A device only ever has one open segment: the lexicographically last one
 * (segment names are open-instant timestamps, so highest = newest). Every
 * earlier one is immutable/closed. Used when ingesting another device's
 * segments, which arrive without a status flag.
 */
export function classifyRemoteStatuses(segmentNames: string[]): Record<string, 'open' | 'closed'> {
	const sorted = [...segmentNames].sort();
	const out: Record<string, 'open' | 'closed'> = {};
	sorted.forEach((n, i) => {
		out[n] = i === sorted.length - 1 ? 'open' : 'closed';
	});
	return out;
}
