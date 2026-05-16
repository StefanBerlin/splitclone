/**
 * Event construction and the JSONL wire codec (SC-ARC-LOG-3).
 *
 * JSON has no bigint, and Money must round-trip exactly, so a Money value is
 * encoded as a tagged object {"$bigint":"<minor units>"}. This tagging is part
 * of the file format (SC-ARC-FMT-1) — changing it post-v1.0 needs approval
 * (SC-ARC-FMT-3).
 */
import type { EventKind, EventPayloads, ISOInstant, LedgerEvent, UUID } from './types';

const EVENT_KINDS: ReadonlySet<string> = new Set<EventKind>([
	'LedgerRenamed',
	'ParticipantAdded',
	'ParticipantRenamed',
	'ParticipantClaimed',
	'LabelCreated',
	'LabelRenamed',
	'LabelDeleted',
	'ExpenseCreated',
	'ExpenseUpdated',
	'ExpenseDeleted',
	'SettlementRecorded',
	'SettlementUpdated',
	'SettlementDeleted'
]);

export interface EventMeta {
	id: UUID;
	schemaVersion: number;
	authorDeviceId: UUID;
	authorParticipantId: UUID;
	entryAt: ISOInstant;
}

/**
 * Build a typed envelope. Domain is pure: ids/timestamps are injected.
 * Returns the specific `LedgerEvent` union member for `K` so the result
 * assigns cleanly into `LedgerEvent[]` (the bare `EventEnvelope<K>` does not
 * widen to the mapped union for a generic `K`). The single cast is the
 * factory's typed seam.
 */
export function makeEvent<K extends EventKind>(
	kind: K,
	payload: EventPayloads[K],
	meta: EventMeta
): Extract<LedgerEvent, { kind: K }> {
	return { kind, payload, ...meta } as Extract<LedgerEvent, { kind: K }>;
}

interface BigIntTag {
	$bigint: string;
}

function isBigIntTag(v: unknown): v is BigIntTag {
	return (
		typeof v === 'object' &&
		v !== null &&
		!Array.isArray(v) &&
		Object.keys(v).length === 1 &&
		typeof (v as Record<string, unknown>).$bigint === 'string'
	);
}

export function encodeEvent(event: LedgerEvent): string {
	return JSON.stringify(event, (_key, value) =>
		typeof value === 'bigint' ? { $bigint: value.toString() } : value
	);
}

export function decodeEvent(line: string): LedgerEvent {
	const parsed: unknown = JSON.parse(line, (_key, value) =>
		isBigIntTag(value) ? BigInt(value.$bigint) : value
	);

	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		!('kind' in parsed) ||
		!EVENT_KINDS.has((parsed as { kind: unknown }).kind as string) ||
		!('id' in parsed) ||
		!('entryAt' in parsed) ||
		!('payload' in parsed)
	) {
		throw new Error('Corrupt or unrecognised event line');
	}

	return parsed as LedgerEvent;
}
