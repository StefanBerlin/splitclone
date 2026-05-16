/**
 * Core domain types. Pure data shapes only — no behaviour, no I/O.
 *
 * Money is a bigint in the ledger currency's smallest unit (e.g. euro cents).
 * This eliminates floating-point rounding entirely and makes the deterministic
 * rounding rule (SC-FR-SPL-2) exact. Decimal <-> minor-unit conversion lives
 * in money.ts; currency-symbol display lives in the ui layer.
 */
export type UUID = string;
export type Money = bigint;
export type ISODate = string; // YYYY-MM-DD
export type ISOInstant = string; // YYYY-MM-DDTHH:mm:ss.sssZ
export type CurrencyCode = string; // ISO 4217, e.g. "EUR"

// ---------------------------------------------------------------------------
// Derived entities (what fold() produces)
// ---------------------------------------------------------------------------

export interface Participant {
	id: UUID;
	name: string;
	/** Device that has claimed this participant, if any (SC-FR-PRT-2). */
	claimedByDeviceId?: UUID;
}

export interface Label {
	id: UUID;
	name: string;
}

/** User-editable fields of an expense. Carried verbatim in events. */
export interface ExpenseInput {
	title: string;
	amount: Money; // > 0
	executionDate: ISODate; // when it happened (SC-FR-EXP-1)
	payerId: UUID;
	splitParticipantIds: UUID[]; // >= 1; may or may not include payer (SC-FR-SPL-3)
	labelIds: UUID[];
	note?: string;
}

/** An expense in the derived state: input + provenance (SC-FR-HIS-2). */
export interface Expense extends ExpenseInput {
	id: UUID;
	createdAt: ISOInstant; // entry timestamp of the ExpenseCreated event
	createdBy: UUID; // participant who created it
	lastEditedAt?: ISOInstant; // entry timestamp of the latest ExpenseUpdated
	lastEditedBy?: UUID;
}

export interface SettlementInput {
	fromParticipantId: UUID;
	toParticipantId: UUID;
	amount: Money; // > 0
	date: ISODate;
	note?: string;
}

export interface Settlement extends SettlementInput {
	id: UUID;
	createdAt: ISOInstant;
	createdBy: UUID;
}

export interface DerivedState {
	ledgerName: string;
	participants: Map<UUID, Participant>;
	labels: Map<UUID, Label>;
	expenses: Map<UUID, Expense>; // tombstoned ones excluded
	settlements: Map<UUID, Settlement>; // tombstoned ones excluded
}

// ---------------------------------------------------------------------------
// Events (the source of truth — SC-ARC-LOG-2)
// ---------------------------------------------------------------------------

export type EventKind =
	| 'LedgerRenamed'
	| 'ParticipantAdded'
	| 'ParticipantRenamed'
	| 'ParticipantClaimed'
	| 'LabelCreated'
	| 'LabelRenamed'
	| 'LabelDeleted'
	| 'ExpenseCreated'
	| 'ExpenseUpdated'
	| 'ExpenseDeleted'
	| 'SettlementRecorded'
	| 'SettlementDeleted';

export interface EventPayloads {
	LedgerRenamed: { name: string };
	ParticipantAdded: { participantId: UUID; name: string };
	ParticipantRenamed: { participantId: UUID; name: string };
	ParticipantClaimed: { participantId: UUID; deviceId: UUID };
	LabelCreated: { labelId: UUID; name: string };
	LabelRenamed: { labelId: UUID; name: string };
	LabelDeleted: { labelId: UUID };
	ExpenseCreated: { expenseId: UUID; input: ExpenseInput };
	ExpenseUpdated: { expenseId: UUID; input: ExpenseInput };
	ExpenseDeleted: { expenseId: UUID };
	SettlementRecorded: { settlementId: UUID; input: SettlementInput };
	SettlementDeleted: { settlementId: UUID };
}

/**
 * One line of an event-log segment. `entryAt` is the authoritative wall-clock
 * used for the deterministic merge ordering (SC-ARC-MRG-1); ties break on `id`.
 */
export interface EventEnvelope<K extends EventKind = EventKind> {
	id: UUID;
	kind: K;
	schemaVersion: number;
	authorDeviceId: UUID;
	authorParticipantId: UUID;
	entryAt: ISOInstant;
	payload: EventPayloads[K];
}

/** Discriminated union over all event kinds. */
export type LedgerEvent = {
	[K in EventKind]: EventEnvelope<K>;
}[EventKind];
