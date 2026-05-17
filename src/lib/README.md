# `src/lib` — module map

Layering and import rules are defined in [`docs/architecture.md`](../../docs/architecture.md) §2
and enforced by the ESLint config (`src/lib/domain/**` is import-restricted).

| Folder      | Responsibility                                                                                                                      | Owns (SC- requirements)                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `domain/`   | **Pure** functions: types, event codecs, fold, splits, balances, export projections. No I/O, no framework, no clock, no randomness. | `SC-ARC-MRG-1/2`, `SC-FR-SPL-*`, `SC-FR-BAL-*`, `SC-FR-EXR-3`                 |
| `storage/`  | All persistence I/O: provider interface + OneDrive Graph impl, AES-GCM codec, join codes, segment store, metadata, IndexedDB.       | `SC-ARC-PRV-*`, `SC-ARC-ENC-*`, `SC-ARC-LOG-*`, `SC-FR-LED-*`, `SC-ARC-CCH-1` |
| `sync/`     | Pull/push orchestration, outbound queue, sync status store.                                                                         | `SC-FR-SYN-*`, `SC-NFR-OFF-1`                                                 |
| `export/`   | CSV formatter + browser/Web-Share delivery.                                                                                         | `SC-FR-EXR-4/5/6/7`                                                           |
| `auth/`     | OAuth 2.0 PKCE flow, token storage.                                                                                                 | `SC-NFR-SEC-2`                                                                |
| `platform/` | Browser primitives behind a seam: device id, time, service-worker registration.                                                     | `SC-ARC-IDN-1/2`                                                              |
| `ui/`       | Svelte stores, components, display formatters. Depends on `domain/` only.                                                           | every user-facing `SC-FR-*`                                                   |

Phase status (see implementation plan): Phase 1 creates the skeleton only.
Modules are filled in by later phases.
