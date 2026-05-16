/**
 * Per-device append-only segment store (SC-ARC-LOG-1, -3, -4, -5, -6).
 *
 * A device writes only to its own segments. Appends go to the single open
 * segment; when the next write would exceed the threshold the open segment is
 * closed (immutable) and a new one opened (SC-ARC-LOG-4). Nothing is ever
 * rewritten or compacted (SC-ARC-LOG-6). Phase 4 stores plaintext JSONL;
 * Phase 5 seals each segment through the AES-GCM codec before it is written
 * here / uploaded — the rotation logic is unchanged.
 */
import { decodeEvent, encodeEvent } from '$lib/domain';
import type { LedgerEvent } from '$lib/domain';
import {
	segmentId,
	segmentPut,
	segmentsByLedger,
	segmentsDeleteByLedger,
	type SegmentRecord
} from './indexed-db';
import { byteLength, newSegmentName, shouldRotate } from './segment-policy';

/** Fold input: every segment of a ledger, ordered so a device's events are
 *  contiguous and chronological (fold re-sorts globally anyway). */
export async function loadLedgerEvents(ledgerId: string): Promise<LedgerEvent[]> {
	const segs = await segmentsByLedger(ledgerId);
	segs.sort((a, b) =>
		a.deviceId !== b.deviceId
			? a.deviceId < b.deviceId
				? -1
				: 1
			: a.name < b.name
				? -1
				: a.name > b.name
					? 1
					: 0
	);
	const events: LedgerEvent[] = [];
	for (const seg of segs) {
		for (const line of seg.text.split('\n')) {
			if (line.length > 0) events.push(decodeEvent(line));
		}
	}
	return events;
}

async function openSegmentFor(
	ledgerId: string,
	deviceId: string
): Promise<SegmentRecord | undefined> {
	const segs = await segmentsByLedger(ledgerId);
	return segs.find((s) => s.deviceId === deviceId && s.status === 'open');
}

/**
 * Append one event to this device's log, rotating first if the open segment
 * would overflow. A brand-new open segment is created when none exists or the
 * previous one was just closed.
 */
export async function appendEvent(
	ledgerId: string,
	deviceId: string,
	event: LedgerEvent
): Promise<void> {
	const line = encodeEvent(event) + '\n';
	const lineBytes = byteLength(line);
	const now = new Date();

	let open = await openSegmentFor(ledgerId, deviceId);

	if (open && shouldRotate(open.byteLength, lineBytes)) {
		await segmentPut({ ...open, status: 'closed', updatedAt: now.toISOString() });
		open = undefined;
	}

	if (!open) {
		const name = newSegmentName(now);
		open = {
			id: segmentId(ledgerId, deviceId, name),
			ledgerId,
			deviceId,
			name,
			status: 'open',
			text: '',
			byteLength: 0,
			updatedAt: now.toISOString()
		};
	}

	await segmentPut({
		...open,
		text: open.text + line,
		byteLength: open.byteLength + lineBytes,
		updatedAt: now.toISOString()
	});
}

export async function deleteLedgerSegments(ledgerId: string): Promise<void> {
	await segmentsDeleteByLedger(ledgerId);
}
