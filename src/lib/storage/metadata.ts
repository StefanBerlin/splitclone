/**
 * Plaintext ledger metadata file `ledger.json` (SC-FR-LED-3, SC-ARC-ENC-3).
 *
 * This is the ONLY unencrypted file in a ledger folder. It deliberately
 * carries nothing sensitive — no ledger name, no participants, no labels
 * (those live only in the encrypted event log). Just enough for a joining
 * device to recognise the folder and check it has the right key.
 */
export interface LedgerMetadata {
	ledgerId: string;
	schemaVersion: number;
	createdAt: string;
	encrypted: true;
	/** First 16 bytes of SHA-256(data key), hex (SC-ARC-ENC-3). */
	keyFingerprint: string;
}

export const METADATA_FILENAME = 'ledger.json';
const SCHEMA_VERSION = 1;

export function buildMetadata(ledgerId: string, keyFingerprint: string): LedgerMetadata {
	return {
		ledgerId,
		schemaVersion: SCHEMA_VERSION,
		createdAt: new Date().toISOString(),
		encrypted: true,
		keyFingerprint
	};
}

export function encodeMetadata(m: LedgerMetadata): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(m, null, 2) + '\n');
}

export function parseMetadata(bytes: Uint8Array): LedgerMetadata {
	const obj: unknown = JSON.parse(new TextDecoder().decode(bytes));
	if (
		!obj ||
		typeof obj !== 'object' ||
		typeof (obj as LedgerMetadata).ledgerId !== 'string' ||
		typeof (obj as LedgerMetadata).keyFingerprint !== 'string' ||
		(obj as LedgerMetadata).encrypted !== true
	) {
		throw new Error('Not a recognised SplitClone ledger (bad metadata).');
	}
	return obj as LedgerMetadata;
}
