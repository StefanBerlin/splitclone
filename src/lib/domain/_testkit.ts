/**
 * Test-only scenario builders. Not imported by app code, so it never reaches
 * the bundle. Kept inside domain/ because it must obey the same purity rule
 * (deterministic ids/timestamps, no clock).
 */
import { makeEvent } from './events';
import type { EventKind, EventPayloads, EventEnvelope } from './types';

let seq = 0;

/** Deterministic monotonic instant; pass an explicit one to control ordering. */
export function instant(n: number): string {
	return `2026-05-14T00:00:${String(n).padStart(2, '0')}.000Z`;
}

export function resetSeq(): void {
	seq = 0;
}

/**
 * Build an event. `id` and `entryAt` default to a deterministic increasing
 * sequence so tests that don't care about ordering stay terse; override either
 * to exercise the merge rules.
 */
export function ev<K extends EventKind>(
	kind: K,
	payload: EventPayloads[K],
	overrides: Partial<
		Pick<EventEnvelope<K>, 'id' | 'entryAt' | 'authorDeviceId' | 'authorParticipantId'>
	> = {}
): EventEnvelope<K> {
	seq += 1;
	return makeEvent(kind, payload, {
		id: overrides.id ?? `evt-${String(seq).padStart(4, '0')}`,
		schemaVersion: 1,
		authorDeviceId: overrides.authorDeviceId ?? 'dev-A',
		authorParticipantId: overrides.authorParticipantId ?? 'p-anna',
		entryAt: overrides.entryAt ?? instant(seq)
	});
}
