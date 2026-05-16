import type { DerivedState, UUID } from '../types';
import { projectCash } from './cash';
import { projectVirtual } from './virtual';
import type { ExportMode, ExportRow } from './types';

export type { ExportMode, ExportRow } from './types';
export { projectCash } from './cash';
export { projectVirtual } from './virtual';

export function project(state: DerivedState, subjectId: UUID, mode: ExportMode): ExportRow[] {
	return mode === 'cash' ? projectCash(state, subjectId) : projectVirtual(state, subjectId);
}
