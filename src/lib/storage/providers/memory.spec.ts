import { describe, expect, it } from 'vitest';
import { PreconditionFailedError, NotFoundError } from '../provider';
import { MemoryProvider } from './memory';

const bytes = (s: string) => new TextEncoder().encode(s);

describe('MemoryProvider (test double, arch A4)', () => {
	it('round-trips write/read with a fresh ETag', async () => {
		const p = new MemoryProvider();
		const { etag } = await p.write('a/b.txt', bytes('hi'));
		const got = await p.read('a/b.txt');
		expect(new TextDecoder().decode(got.bytes)).toBe('hi');
		expect(got.etag).toBe(etag);
	});

	it('read of a missing file throws NotFoundError', async () => {
		await expect(new MemoryProvider().read('nope')).rejects.toBeInstanceOf(NotFoundError);
	});

	it('ifNoneMatch:* fails when the file already exists', async () => {
		const p = new MemoryProvider();
		await p.write('m.json', bytes('1'));
		await expect(p.write('m.json', bytes('2'), { ifNoneMatch: '*' })).rejects.toBeInstanceOf(
			PreconditionFailedError
		);
	});

	it('ifMatch enforces optimistic concurrency', async () => {
		const p = new MemoryProvider();
		const first = await p.write('s.enc', bytes('v1'));
		await expect(p.write('s.enc', bytes('v2'), { ifMatch: 'stale' })).rejects.toBeInstanceOf(
			PreconditionFailedError
		);
		const second = await p.write('s.enc', bytes('v2'), { ifMatch: first.etag });
		expect(second.etag).not.toBe(first.etag);
	});

	it('list returns immediate files and folders only', async () => {
		const p = new MemoryProvider();
		await p.write('events/devA/1.jsonl.enc', bytes('x'));
		await p.write('events/devB/1.jsonl.enc', bytes('y'));
		await p.write('ledger.json', bytes('{}'));
		const root = await p.list('');
		expect(root.map((e) => `${e.name}:${e.isFolder}`).sort()).toEqual([
			'events:true',
			'ledger.json:false'
		]);
		const ev = await p.list('events');
		expect(
			ev
				.filter((e) => e.isFolder)
				.map((e) => e.name)
				.sort()
		).toEqual(['devA', 'devB']);
	});
});
