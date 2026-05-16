/**
 * Build-wide constants. Kept tiny and dependency-free so any layer may import it.
 *
 * SCHEMA_VERSION is the single monotonically-increasing integer that identifies
 * the on-disk / on-the-wire file format (see docs/requirements.sdoc SC-ARC-FMT-1).
 * It is NOT the app version. Bumping it is governed by SC-ARC-FMT-3 — after
 * v1.0 it requires explicit owner approval.
 */
export const APP_VERSION = '0.1.0';

export const SCHEMA_VERSION = 1 as const;
