/**
 * SharedFolderProvider abstraction (SC-ARC-PRV-1, SC-ARC-PRV-2).
 *
 * The whole rest of the app talks to shared storage only through this
 * interface, so a future iCloud/Dropbox/native-Files back-end is a new
 * implementation and nothing else changes. The MVP ships exactly one impl:
 * `providers/onedrive-graph.ts` (SC-ARC-PRV-3). `providers/memory.ts` is a
 * test double (architecture open question A4).
 *
 * Errors are split per SC-ARC-PRV-2: `TransportError` (network/timeout/5xx —
 * worth retrying) vs `SemanticError` (4xx the caller must handle), with
 * `PreconditionFailedError` (HTTP 412) called out because the sync engine
 * branches on it.
 */
export type ISOInstant = string;

export interface FileEntry {
	name: string;
	/** Immediate children only; folders are listed too so callers can
	 *  descend the `events/<deviceId>/` layout (SC-ARC-LOG-4). */
	isFolder: boolean;
	size: number;
	lastModified: ISOInstant;
	etag: string;
}

export interface Precondition {
	/** Only write if the current remote ETag matches (optimistic concurrency). */
	ifMatch?: string;
	/** Only create if the file does not already exist. */
	ifNoneMatch?: '*';
}

export interface SharedFolderProvider {
	/** Directory listing of `path` (a folder). Missing folder → `[]`. */
	list(path: string): Promise<FileEntry[]>;
	read(path: string): Promise<{ bytes: Uint8Array; etag: string }>;
	write(path: string, bytes: Uint8Array, precondition?: Precondition): Promise<{ etag: string }>;
	delete(path: string): Promise<void>;
}

export class TransportError extends Error {
	constructor(
		message: string,
		override readonly cause?: unknown
	) {
		super(message);
		this.name = 'TransportError';
	}
}

export class SemanticError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'SemanticError';
	}
}

export class PreconditionFailedError extends SemanticError {
	constructor(message = 'Precondition failed (remote changed)') {
		super(message, 412);
		this.name = 'PreconditionFailedError';
	}
}

export class NotFoundError extends SemanticError {
	constructor(message = 'Not found') {
		super(message, 404);
		this.name = 'NotFoundError';
	}
}
