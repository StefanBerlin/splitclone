/**
 * Pure segment-rotation policy (SC-ARC-LOG-4 / SC-ARC-LOG-5). No I/O — kept
 * separate from segment-store so the rule is unit-testable without IndexedDB.
 *
 * Threshold note: SC-ARC-LOG-5 specifies 1 MiB (1,048,576 bytes) for
 * production; raised from the 4 KiB dev value at Phase 9 (v1.0 hardening) now
 * that rotation has been reviewed. It is a tunable constant and does not
 * affect interoperability — every device folds all segments regardless of
 * where another device drew its boundaries (SRS Q2), so this is not a
 * file-format change and needs no CHANGELOG entry.
 */
export const SEGMENT_THRESHOLD = 1024 * 1024;

/** UTF-8 byte length of a string. */
export function byteLength(s: string): number {
	return new TextEncoder().encode(s).length;
}

/**
 * Whether appending `incomingBytes` to the open segment must first rotate.
 * An empty segment never rotates (a single oversized event still lands
 * somewhere); otherwise rotate when the write would exceed the threshold.
 */
export function shouldRotate(
	currentBytes: number,
	incomingBytes: number,
	threshold: number = SEGMENT_THRESHOLD
): boolean {
	if (currentBytes === 0) return false;
	return currentBytes + incomingBytes > threshold;
}

function pad(n: number, width: number): string {
	return String(n).padStart(width, '0');
}

/**
 * Segment filename for an open instant: "YYYYMMDDTHHMMSSsss" in UTC, so
 * lexicographic order matches chronological order (SC-ARC-LOG-4).
 */
export function newSegmentName(at: Date): string {
	return (
		pad(at.getUTCFullYear(), 4) +
		pad(at.getUTCMonth() + 1, 2) +
		pad(at.getUTCDate(), 2) +
		'T' +
		pad(at.getUTCHours(), 2) +
		pad(at.getUTCMinutes(), 2) +
		pad(at.getUTCSeconds(), 2) +
		pad(at.getUTCMilliseconds(), 3)
	);
}
