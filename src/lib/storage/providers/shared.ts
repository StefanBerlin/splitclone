/**
 * Resolve SplitClone ledger folders that another person has shared with the
 * signed-in user (the joiner side of true multi-user, SC-ARC-PRV-3). Uses
 * Graph's "shared with me" so the joiner needs no folder picker — they just
 * paste the recovery code and we find the folder whose metadata fingerprint
 * matches (done by the caller in the sync engine).
 */
import { GRAPH_BASE } from '$lib/auth/config';
import { TransportError } from '../provider';
import type { RootRef, TokenGetter } from './onedrive-graph';

export interface SharedFolderRef {
	name: string;
	root: Extract<RootRef, { kind: 'shared' }>;
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
