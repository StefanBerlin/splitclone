/**
 * Resolve SplitClone ledger folders that another person has shared with the
 * signed-in user (the joiner side of true multi-user, SC-ARC-PRV-3). Uses
 * Graph's "shared with me" so the joiner needs no folder picker — they just
 * paste the recovery code and we find the folder whose metadata fingerprint
 * matches (done by the caller in the sync engine).
 */
import { GRAPH_BASE } from '$lib/auth/config';
import { TransportError } from '../provider';
import { APP_FOLDER, type RootRef, type TokenGetter } from './onedrive-graph';

export interface SharedFolderRef {
	name: string;
	root: Extract<RootRef, { kind: 'shared' }>;
}

export interface OwnFolderRef {
	name: string;
	root: Extract<RootRef, { kind: 'own' }>;
}

interface SharedItem {
	name?: string;
	folder?: unknown;
	remoteItem?: {
		id?: string;
		folder?: unknown;
		parentReference?: { driveId?: string };
	};
}

/** Folders (only) shared with the current user, as `shared` RootRefs. */
export async function listSharedFolders(getToken: TokenGetter): Promise<SharedFolderRef[]> {
	const token = await getToken();
	if (!token) return [];
	let res: Response;
	try {
		res = await fetch(`${GRAPH_BASE}/me/drive/sharedWithMe`, {
			headers: { Authorization: `Bearer ${token}` }
		});
	} catch (e) {
		throw new TransportError('Network error listing shared folders', e);
	}
	if (!res.ok) return [];
	const json = (await res.json()) as { value: SharedItem[] };
	const out: SharedFolderRef[] = [];
	for (const it of json.value) {
		const r = it.remoteItem;
		const driveId = r?.parentReference?.driveId;
		const itemId = r?.id;
		const isFolder = !!(r?.folder ?? it.folder);
		if (!driveId || !itemId || !isFolder) continue;
		out.push({
			name: it.name ?? '',
			root: { kind: 'shared', driveId, itemId }
		});
	}
	return out;
}

/**
 * Ledger folders in the signed-in user's OWN drive (`Apps/SplitClone/*`).
 * This is what makes same-account multi-device work: the creator's ledger
 * lives in their own drive, not under "shared with me", so joining on a
 * second device of the same account must scan here too. Also covers
 * re-adopting your own ledger after local data loss (SC-NFR-OFF-1).
 */
export async function listOwnLedgerFolders(getToken: TokenGetter): Promise<OwnFolderRef[]> {
	const token = await getToken();
	if (!token) return [];
	let res: Response;
	try {
		res = await fetch(`${GRAPH_BASE}/me/drive/root:/${APP_FOLDER}:/children?$top=200`, {
			headers: { Authorization: `Bearer ${token}` }
		});
	} catch (e) {
		throw new TransportError('Network error listing your OneDrive folders', e);
	}
	if (!res.ok) return []; // 404 = app folder not created yet → nothing to join
	const json = (await res.json()) as { value: { name?: string; folder?: unknown }[] };
	const out: OwnFolderRef[] = [];
	for (const it of json.value) {
		if (!it.folder || !it.name) continue;
		out.push({ name: it.name, root: { kind: 'own', ledgerId: it.name } });
	}
	return out;
}

/**
 * Immediate child folders of a shared folder, as `shared` RootRefs. Lets a
 * person share the whole `SplitClone` parent folder once (instead of one
 * folder per ledger): the recipient's join scan then descends one level to
 * find the per-ledger folders that actually contain `ledger.json`.
 */
export async function listSharedChildFolders(
	getToken: TokenGetter,
	parent: Extract<RootRef, { kind: 'shared' }>
): Promise<SharedFolderRef[]> {
	const token = await getToken();
	if (!token) return [];
	let res: Response;
	try {
		res = await fetch(
			`${GRAPH_BASE}/drives/${parent.driveId}/items/${parent.itemId}/children?$top=200`,
			{ headers: { Authorization: `Bearer ${token}` } }
		);
	} catch (e) {
		throw new TransportError('Network error listing shared subfolders', e);
	}
	if (!res.ok) return [];
	const json = (await res.json()) as {
		value: {
			id?: string;
			name?: string;
			folder?: unknown;
			parentReference?: { driveId?: string };
		}[];
	};
	const out: SharedFolderRef[] = [];
	for (const it of json.value) {
		if (!it.folder || !it.id) continue;
		out.push({
			name: it.name ?? '',
			root: {
				kind: 'shared',
				driveId: it.parentReference?.driveId ?? parent.driveId,
				itemId: it.id
			}
		});
	}
	return out;
}
