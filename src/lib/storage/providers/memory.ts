/**
 * In-memory SharedFolderProvider — the test double from architecture open
 * question A4. Models just enough OneDrive semantics for the sync engine:
 * monotonic ETags, If-Match / If-None-Match preconditions, folder listing
 * by path prefix, and 404 on missing reads.
 */
import {
	NotFoundError,
	PreconditionFailedError,
	type FileEntry,
	type Precondition,
	type SharedFolderProvider
} from '../provider';

interface Node {
	bytes: Uint8Array;
	etag: string;
	lastModified: string;
}

export class MemoryProvider implements SharedFolderProvider {
	private files = new Map<string, Node>();
	private seq = 0;

	private nextEtag(): string {
		this.seq += 1;
		return `etag-${this.seq}`;
	}

	async list(path: string): Promise<FileEntry[]> {
		const prefix = path === '' ? '' : path.endsWith('/') ? path : `${path}/`;
		const files = new Map<string, FileEntry>();
		const folders = new Set<string>();
		for (const [p, n] of this.files) {
			if (!p.startsWith(prefix)) continue;
			const rest = p.slice(prefix.length);
			const slash = rest.indexOf('/');
			if (slash === -1) {
				files.set(rest, {
					name: rest,
					isFolder: false,
					size: n.bytes.length,
					lastModified: n.lastModified,
					etag: n.etag
				});
			} else {
				folders.add(rest.slice(0, slash));
			}
		}
		const out: FileEntry[] = [...files.values()];
		for (const f of folders) {
			out.push({ name: f, isFolder: true, size: 0, lastModified: '', etag: '' });
		}
		return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	}

	async read(path: string): Promise<{ bytes: Uint8Array; etag: string }> {
		const n = this.files.get(path);
		if (!n) throw new NotFoundError(`no such file: ${path}`);
		return { bytes: n.bytes, etag: n.etag };
	}

	async write(
		path: string,
		bytes: Uint8Array,
		precondition?: Precondition
	): Promise<{ etag: string }> {
		const existing = this.files.get(path);
		if (precondition?.ifNoneMatch === '*' && existing) {
			throw new PreconditionFailedError('file already exists');
		}
		if (precondition?.ifMatch !== undefined && existing?.etag !== precondition.ifMatch) {
			throw new PreconditionFailedError();
		}
		const etag = this.nextEtag();
		this.files.set(path, { bytes, etag, lastModified: new Date().toISOString() });
		return { etag };
	}

	async delete(path: string): Promise<void> {
		this.files.delete(path);
	}
}
