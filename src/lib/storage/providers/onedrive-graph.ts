/**
 * Microsoft Graph OneDrive provider (SC-ARC-PRV-3). Hand-rolled `fetch`
 * against the Graph REST API — no `@microsoft/microsoft-graph-client` SDK,
 * matching this project's anti-dependency posture (hand-rolled IDB, PKCE,
 * no MSAL). A deliberate deviation from the architecture's SDK note; see
 * CHANGELOG.
 *
 * The provider is rooted at one ledger folder and addresses two ways:
 *   - `own`    : a folder the signed-in user owns,
 *                `/me/drive/root:/Apps/SplitClone/<ledgerId>`
 *   - `shared` : the same folder as it appears under another user's
 *                "shared with me", `/drives/<driveId>/items/<itemId>`
 * Paths handed in are relative to that ledger folder (see `sync/paths.ts`).
 *
 * ETag handling powers SC-ARC-PRV-2's conditional write: `ifMatch` → the
 * `If-Match` header; `ifNoneMatch:'*'` → Graph's `conflictBehavior=fail`.
 */
import { GRAPH_BASE } from '$lib/auth/config';
import {
	NotFoundError,
	PreconditionFailedError,
	SemanticError,
	TransportError,
	type FileEntry,
	type Precondition,
	type SharedFolderProvider
} from '../provider';

export type RootRef =
	| { kind: 'own'; ledgerId: string }
	| { kind: 'shared'; driveId: string; itemId: string };

export type TokenGetter = () => Promise<string | null>;

const APP_FOLDER = 'Apps/SplitClone';

interface DriveItem {
	name: string;
	size?: number;
	lastModifiedDateTime?: string;
	eTag?: string;
	file?: unknown;
	folder?: unknown;
}

function encodePath(path: string): string {
	return path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

function rootUrl(root: RootRef, rel: string, suffix: string): string {
	if (root.kind === 'own') {
		const full = encodePath(`${APP_FOLDER}/${root.ledgerId}${rel ? `/${rel}` : ''}`);
		return `${GRAPH_BASE}/me/drive/root:/${full}:${suffix}`;
	}
	const base = `${GRAPH_BASE}/drives/${root.driveId}/items/${root.itemId}`;
	return rel ? `${base}:/${encodePath(rel)}:${suffix}` : `${base}${suffix}`;
}

export class OneDriveGraphProvider implements SharedFolderProvider {
	constructor(
		private readonly getToken: TokenGetter,
		private readonly root: RootRef
	) {}

	private async authHeaders(): Promise<Record<string, string>> {
		const token = await this.getToken();
		if (!token) throw new SemanticError('Not signed in to OneDrive', 401);
		return { Authorization: `Bearer ${token}` };
	}

	private async call(url: string, init: RequestInit): Promise<Response> {
		let res: Response;
		try {
			res = await fetch(url, init);
		} catch (e) {
			throw new TransportError('Network error talking to OneDrive', e);
		}
		if (res.status === 412) throw new PreconditionFailedError();
		if (res.status === 404) throw new NotFoundError();
		if (res.status === 429 || res.status >= 500) {
			throw new TransportError(`OneDrive ${res.status}`);
		}
		if (!res.ok && res.status >= 400) {
			const body = await res.text().catch(() => '');
			throw new SemanticError(`OneDrive ${res.status}: ${body.slice(0, 200)}`, res.status);
		}
		return res;
	}

	async list(path: string): Promise<FileEntry[]> {
		let res: Response;
		try {
			res = await this.call(rootUrl(this.root, path, '/children?$top=200'), {
				headers: await this.authHeaders()
			});
		} catch (e) {
			if (e instanceof NotFoundError) return []; // folder not created yet
			throw e;
		}
		const json = (await res.json()) as { value: DriveItem[] };
		return json.value.map((it) => ({
			name: it.name,
			isFolder: !!it.folder,
			size: it.size ?? 0,
			lastModified: it.lastModifiedDateTime ?? '',
			etag: it.eTag ?? ''
		}));
	}

	async read(path: string): Promise<{ bytes: Uint8Array; etag: string }> {
		const res = await this.call(rootUrl(this.root, path, '/content'), {
			headers: await this.authHeaders()
		});
		return {
			bytes: new Uint8Array(await res.arrayBuffer()),
			etag: res.headers.get('ETag') ?? ''
		};
	}

	async write(
		path: string,
		bytes: Uint8Array,
		precondition?: Precondition
	): Promise<{ etag: string }> {
		const headers: Record<string, string> = {
			...(await this.authHeaders()),
			'Content-Type': 'application/octet-stream'
		};
		if (precondition?.ifMatch !== undefined) headers['If-Match'] = precondition.ifMatch;
		const suffix =
			precondition?.ifNoneMatch === '*'
				? '/content?@microsoft.graph.conflictBehavior=fail'
				: '/content';
		const res = await this.call(rootUrl(this.root, path, suffix), {
			method: 'PUT',
			headers,
			body: bytes.slice().buffer
		});
		const item = (await res.json()) as DriveItem;
		return { etag: item.eTag ?? '' };
	}

	async delete(path: string): Promise<void> {
		try {
			await this.call(rootUrl(this.root, path, ''), {
				method: 'DELETE',
				headers: await this.authHeaders()
			});
		} catch (e) {
			if (e instanceof NotFoundError) return; // already gone
			throw e;
		}
	}
}
