/**
 * Device identity (SC-ARC-IDN-1). A random v4 UUID generated on first launch
 * and persisted in browser IndexedDB under the app's origin. It is the
 * device's identity across all ledgers and never leaves the device except as
 * the segment-folder name inside each shared folder.
 *
 * If the IndexedDB record is lost (cleared storage, private-browsing,
 * iOS Safari long-disuse eviction), a fresh id is generated next launch and
 * the user re-claims a participant — prior segments stay valid history
 * (SC-ARC-IDN-1).
 */
import { metaGet, metaSet } from '$lib/storage/indexed-db';

const DEVICE_ID_KEY = 'deviceId';

export async function getDeviceId(): Promise<string> {
	const existing = await metaGet<string>(DEVICE_ID_KEY);
	if (existing) return existing;
	const id = crypto.randomUUID();
	await metaSet(DEVICE_ID_KEY, id);
	return id;
}
