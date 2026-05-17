import { describe, it, expect } from 'vitest';
import { fold } from './fold';
import { deviceClaim, participantsClaimedElsewhere, unclaimedParticipants } from './selectors';
import type { LedgerEvent } from './types';
import { ev, instant } from './_testkit';

// Claims are ordered after the adds with an explicit late entryAt: argument
// evaluation order would otherwise timestamp a claim passed into ledger()
// *before* the participants it refers to, and fold drops a claim whose
// participant doesn't exist yet.
const base: LedgerEvent[] = [
	ev('LedgerRenamed', { name: 'Trip' }, { entryAt: instant(1) }),
	ev('ParticipantAdded', { participantId: 'p-anna', name: 'Anna' }, { entryAt: instant(2) }),
	ev('ParticipantAdded', { participantId: 'p-bo', name: 'Bo' }, { entryAt: instant(3) }),
	ev('ParticipantAdded', { participantId: 'p-cy', name: 'Cy' }, { entryAt: instant(4) })
];
const claim = (participantId: string, deviceId: string, at: number) =>
	ev('ParticipantClaimed', { participantId, deviceId }, { entryAt: instant(at) });

describe('deviceClaim (SC-FR-PRT-2)', () => {
	it('returns the participant a device has claimed', () => {
		const s = fold([...base, claim('p-bo', 'dev-1', 10)]);
		expect(deviceClaim(s, 'dev-1')?.id).toBe('p-bo');
	});

	it('returns undefined when the device has not claimed anyone', () => {
		expect(deviceClaim(fold(base), 'dev-x')).toBeUndefined();
	});
});

describe('unclaimedParticipants (SC-FR-PRT-2a / SC-FR-PRT-4)', () => {
	it('lists every participant when none are claimed, name-sorted', () => {
		expect(unclaimedParticipants(fold(base)).map((p) => p.name)).toEqual(['Anna', 'Bo', 'Cy']);
	});

	it('excludes participants already bound to a device', () => {
		const s = fold([...base, claim('p-anna', 'dev-1', 10), claim('p-cy', 'dev-2', 11)]);
		expect(unclaimedParticipants(s).map((p) => p.id)).toEqual(['p-bo']);
	});

	it('keeps deviceless placeholder participants as claim candidates', () => {
		// Bo never runs the app (SC-FR-PRT-4) but must remain claimable.
		const s = fold([...base, claim('p-anna', 'd', 10)]);
		expect(unclaimedParticipants(s).map((p) => p.id)).toContain('p-bo');
	});
});

describe('participantsClaimedElsewhere (SC-FR-PRT-2c — second device)', () => {
	it('lists identities bound to other devices so a 2nd device can re-claim', () => {
		// Anna is set up on dev-pc; her phone (dev-phone) has claimed no one.
		const s = fold([...base, claim('p-anna', 'dev-pc', 10)]);
		expect(participantsClaimedElsewhere(s, 'dev-phone').map((p) => p.id)).toEqual(['p-anna']);
	});

	it('excludes participants this device already holds', () => {
		const s = fold([...base, claim('p-anna', 'dev-pc', 10), claim('p-bo', 'dev-phone', 11)]);
		// dev-phone holds Bo; Anna (other device) is offered, Bo is not.
		expect(participantsClaimedElsewhere(s, 'dev-phone').map((p) => p.id)).toEqual(['p-anna']);
	});

	it('is empty when nobody else has claimed anything', () => {
		expect(participantsClaimedElsewhere(fold(base), 'dev-x')).toEqual([]);
	});

	it('does not list a participant once this device co-claims it', () => {
		const s = fold([...base, claim('p-anna', 'dev-pc', 10), claim('p-anna', 'dev-phone', 11)]);
		expect(participantsClaimedElsewhere(s, 'dev-phone')).toEqual([]);
		expect(deviceClaim(s, 'dev-phone')?.id).toBe('p-anna');
		expect(deviceClaim(s, 'dev-pc')?.id).toBe('p-anna');
	});
});
