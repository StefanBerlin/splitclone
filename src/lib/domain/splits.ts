/**
 * Equal-split computation.
 *
 * SC-FR-SPL-1: each participant owes amount / N rounded to the smallest unit.
 * SC-FR-SPL-2: the indivisible remainder is assigned deterministically to the
 *              payer, so the shares always sum to exactly the amount.
 * SC-FR-SPL-3: the payer may or may not be among the split participants.
 *
 * Spec refinement (surfaced for review): SC-FR-SPL-2 says the remainder goes
 * "to the payer", but when the payer is excluded from the split (SC-FR-SPL-3)
 * the payer has no share to attach it to. The deterministic fallback here is:
 * assign the whole remainder to the split participant whose UUID sorts first.
 * This keeps the sum exact and the result independent of input order.
 */
import type { Money, UUID } from './types';

export interface SplitInput {
	amount: Money;
	splitParticipantIds: readonly UUID[];
	payerId: UUID;
}

/** Returns each split participant's share. The values sum to exactly `amount`. */
export function splitEqually(input: SplitInput): Map<UUID, Money> {
	const { amount, splitParticipantIds, payerId } = input;

	if (amount <= 0n) {
		throw new Error(`Expense amount must be positive, got ${amount}`);
	}
	if (splitParticipantIds.length === 0) {
		throw new Error('Split must include at least one participant (SC-FR-SPL-1)');
	}
	const ids = [...splitParticipantIds];
	if (new Set(ids).size !== ids.length) {
		throw new Error('Split participant list contains duplicates');
	}

	const n = BigInt(ids.length);
	const base = amount / n; // bigint division floors; amount > 0
	const remainder = amount - base * n; // 0 <= remainder < n

	const shares = new Map<UUID, Money>();
	for (const id of ids) shares.set(id, base);

	if (remainder > 0n) {
		const target = ids.includes(payerId) ? payerId : [...ids].sort().at(0)!; // deterministic fallback, see header
		shares.set(target, base + remainder);
	}

	return shares;
}

/** Convenience: one participant's share, or 0 if they are not in the split. */
export function shareOf(input: SplitInput, participantId: UUID): Money {
	if (!input.splitParticipantIds.includes(participantId)) return 0n;
	return splitEqually(input).get(participantId) ?? 0n;
}
