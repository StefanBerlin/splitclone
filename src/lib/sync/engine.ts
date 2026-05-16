/**
 * Sync engine (SC-FR-SYN-1/2/3, SC-ARC-PRV-2). Moves sealed segments between
 * the local IndexedDB cache and a `SharedFolderProvider` that is already
 * rooted at the ledger folder (owner's own drive, or the same folder under a
 * joiner's "shared with me"). Pure layout maths live in `paths.ts`.
 *
 * Invariant it relies on (SC-ARC-LOG-1): a device writes only its own
 * segments, so the only cross-device interaction is "download the other
 * folders". A 412 on our own segment is essentially a create-race, resolved
 * by re-reading the remote ETag and retrying with our authoritative copy.
 *
 * Phase 6 wires connect + manual sync + a real join (metadata fingerprint
 * check, SC-ARC-ENC-3). Background/auto-sync scheduling is Phase 7.
 */
import { dataKeyFingerprint } from '$lib/storage/encryption';
import {
	segmentId,
	segmentPut,
	segmentsByLedger,
	type SegmentRecord
} from '$lib/storage/indexed-db';
import {
	buildMetadata,
	encodeMetadata,
	parseMetadata,
	type LedgerMetadata
} from '$lib/storage/metadata';
import {
	NotFoundError,
	PreconditionFailedError,
	type SharedFolderProvider
} from '$lib/storage/provider';
import {
	classifyRemoteStatuses,
	deviceFolder,
	EVENTS_ROOT,
	isSegmentFile,
	METADATA_PATH,
	segmentNameFromFile,
	segmentPath
} from './paths';

/** Create the plaintext metadata file if the folder is fresh (SC-FR-LED-3). */
export async function ensureRemoteLedger(
	provider: SharedFolderProvider,
	ledgerId: string,
	keyFingerprint: string
): Promise<void> {
	try {
		await provider.read(METADATA_PATH);
		return;
	} catch (e) {
		if (!(e instanceof NotFoundError)) throw e;
	}
	try {
		await provider.write(METADATA_PATH, encodeMetadata(buildMetadata(ledgerId, keyFingerprint)), {
			ifNoneMatch: '*'
		});
	} catch (e) {
		if (!(e instanceof PreconditionFailedError)) throw e; // another device won the race
	}
}

/** Read + validate remote metadata, checking the key fingerprint against the
 *  imported key (SC-ARC-ENC-3). Throws on wrong code / unrecognised folder. */
export async function checkRemoteLedger(
	provider: SharedFolderProvider,
	rawKey: Uint8Array
): Promise<LedgerMetadata> {
	const { bytes } = await provider.read(METADATA_PATH);
	const meta = parseMetadata(bytes);
	if (meta.keyFingerprint !== (await dataKeyFingerprint(rawKey))) {
		throw new Error('This recovery code does not match this ledger (fingerprint mismatch).');
	}
	return meta;
}

/** Upload this device's segments. Returns how many were (re)uploaded. */
export async function pushLedger(
	provider: SharedFolderProvider,
	ledgerId: string,
	deviceId: string,
	keyFingerprint: string
): Promise<number> {
	await ensureRemoteLedger(provider, ledgerId, keyFingerprint);
	const mine = (await segmentsByLedger(ledgerId)).filter((s) => s.deviceId === deviceId);
	let pushed = 0;
	for (const seg of mine) {
		const path = segmentPath(deviceId, seg.name);
		try {
			const pre = seg.remoteEtag ? { ifMatch: seg.remoteEtag } : { ifNoneMatch: '*' as const };
			const { etag } = await provider.write(path, seg.sealed, pre);
			await segmentPut({ ...seg, remoteEtag: etag });
			pushed += 1;
		} catch (e) {
			if (!(e instanceof PreconditionFailedError)) throw e;
			// We are the sole writer of our own segments, so re-sync the ETag
			// and overwrite with our authoritative local copy.
			const cur = await provider.read(path);
			const { etag } = await provider.write(path, seg.sealed, { ifMatch: cur.etag });
			await segmentPut({ ...seg, remoteEtag: etag });
			pushed += 1;
		}
	}
	return pushed;
}

/** Download every other device's segments into the local cache. Returns how
 *  many segment files were newly fetched or updated. */
export async function pullLedger(
	provider: SharedFolderProvider,
	ledgerId: string,
	ourDeviceId: string
): Promise<number> {
	let top;
	try {
		top = await provider.list(EVENTS_ROOT);
	} catch (e) {
		if (e instanceof NotFoundError) return 0;
		throw e;
	}
	const deviceIds = top.filter((e) => e.isFolder && e.name !== ourDeviceId).map((e) => e.name);
	const local = new Map((await segmentsByLedger(ledgerId)).map((s) => [s.id, s] as const));
	let changed = 0;
	for (const dev of deviceIds) {
		const files = (await provider.list(deviceFolder(dev))).filter(
			(f) => !f.isFolder && isSegmentFile(f.name)
		);
		const statuses = classifyRemoteStatuses(files.map((f) => segmentNameFromFile(f.name)));
		for (const f of files) {
			const name = segmentNameFromFile(f.name);
			const id = segmentId(ledgerId, dev, name);
			const existing = local.get(id);
			if (existing && existing.remoteEtag === f.etag) continue;
			const { bytes, etag } = await provider.read(`${deviceFolder(dev)}/${f.name}`);
			const rec: SegmentRecord = {
				id,
				ledgerId,
				deviceId: dev,
				name,
				status: statuses[name] ?? 'closed',
				sealed: bytes,
				// Plaintext length only matters for our own rotation policy; a
				// foreign segment is never appended to, so 0 is correct here.
				byteLength: 0,
				updatedAt: f.lastModified || new Date().toISOString(),
				remoteEtag: etag
			};
			await segmentPut(rec);
			changed += 1;
		}
	}
	return changed;
}

export interface SyncResult {
	pulled: number;
	pushed: number;
}

/** Manual "sync now" (SC-FR-SYN-2): pull first so our push is conditioned on
 *  fresh state, then push our local writes. */
export async function syncLedger(
	provider: SharedFolderProvider,
	ledgerId: string,
	deviceId: string,
	keyFingerprint: string
): Promise<SyncResult> {
	const pulled = await pullLedger(provider, ledgerId, deviceId);
	const pushed = await pushLedger(provider, ledgerId, deviceId, keyFingerprint);
	return { pulled, pushed };
}
