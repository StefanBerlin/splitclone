import { describe, expect, it } from 'vitest';
import {
	classifyRemoteStatuses,
	deviceFolder,
	isSegmentFile,
	segmentNameFromFile,
	segmentPath
} from './paths';

describe('ledger folder layout (SC-ARC-LOG-4)', () => {
	it('builds device-scoped segment paths', () => {
		expect(deviceFolder('dev1')).toBe('events/dev1');
		expect(segmentPath('dev1', '20260517T101010001')).toBe(
			'events/dev1/20260517T101010001.jsonl.enc'
		);
	});

	it('recognises and strips the segment suffix', () => {
		expect(isSegmentFile('20260517T1.jsonl.enc')).toBe(true);
		expect(isSegmentFile('ledger.json')).toBe(false);
		expect(isSegmentFile('.jsonl.enc')).toBe(false);
		expect(segmentNameFromFile('20260517T1.jsonl.enc')).toBe('20260517T1');
	});

	it('marks only the newest (lexicographically last) segment open', () => {
		const s = classifyRemoteStatuses(['20260301T1', '20260517T9', '20260410T5']);
		expect(s).toEqual({
			'20260301T1': 'closed',
			'20260410T5': 'closed',
			'20260517T9': 'open'
		});
	});

	it('a single segment is open', () => {
		expect(classifyRemoteStatuses(['only'])).toEqual({ only: 'open' });
		expect(classifyRemoteStatuses([])).toEqual({});
	});
});
