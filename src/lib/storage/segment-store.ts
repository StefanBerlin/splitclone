/**
 * Per-device append-only segment store (SC-ARC-LOG-1, -3, -4, -5, -6).
 *
 * A device writes only to its own segments. Appends go to the single open
 * segment; when the next write would exceed the threshold the open segment is
 * closed (immutable) and a new one opened (SC-ARC-LOG-4). Nothing is ever
 * rewritten or compacted (SC-ARC-LOG-6).
 *
 * Phase 5: the body persisted/uploaded is the AES-GCM-sealed envelope, never
 * plaintext (SC-ARC-ENC-2). Append is read-modify-write *through* the codec:
 * decrypt the open segment, append the line, re-seal with a fresh IV. The
 * rotation policy (which works on plaintext byte length) is unchanged.
 */
import { decodeEvent, encodeEvent } from '$lib/domain';
import type { LedgerEvent } from '$lib/domain';
import { openSegment, sealSegment } from './encryption';
import {
	segmentId,
	segmentPut,
	segmentsByLedger,
	segmentsDeleteByLedger,
	type SegmentRecord
} from './indexed-db';
import { byteLength, newSegmentName, shouldRotate } from './segment-policy';

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Fold input: every segment of a ledger, decrypted and ordered so a device's
 *  events are contiguous and chronological (fold re-sorts globally anyway).
 *  Decryption failure is thrown, never swallowed (SC-ARC-ENC-2). */
export async function loadLedgerEvents(
	ledgerId: string,
	key: CryptoKey,
	/** Restrict to one device's segments. Used by the local-only demo ledger,
	 *  whose per-device key cannot open any other device's segments. */
	onlyDeviceId?: string
): Promise<LedgerEvent[]> {
	let segs = await segmentsByLedger(ledgerId);
	if (onlyDeviceId !== undefined) segs = segs.filter((s) => s.deviceId === onlyDeviceId);
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
		const text = dec.decode(await openSegment(seg.sealed, key));
		for (const line of text.split('\n')) {
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
 * previous one was just closed. The whole (decrypted) plaintext is re-sealed
 * with a fresh IV on every append (SC-ARC-ENC-2).
 */
export async function appendEvent(
	ledgerId: string,
	deviceId: string,
	key: CryptoKey,
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

	const priorText = open ? dec.decode(await openSegment(open.sealed, key)) : '';
	const nextText = priorText + line;
	const sealed = await sealSegment(enc.encode(nextText), key);

	const base: Omit<SegmentRecord, 'sealed' | 'byteLength' | 'updatedAt'> = open
		? { id: open.id, ledgerId, deviceId, name: open.name, status: 'open' }
		: (() => {
				const name = newSegmentName(now);
				return {
					id: segmentId(ledgerId, deviceId, name),
					ledgerId,
					deviceId,
					name,
					status: 'open'
				};
			})();

	await segmentPut({
		...base,
		sealed,
		byteLength: (open?.byteLength ?? 0) + lineBytes,
		updatedAt: now.toISOString()
	});
}

export async function deleteLedgerSegments(ledgerId: string): Promise<void> {
	await segmentsDeleteByLedger(ledgerId);
}
