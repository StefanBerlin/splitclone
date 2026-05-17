# Release & verifiable build (SC-ARC-HST-2)

SplitClone is static assets served from an untrusted CDN. The defence
against a tampered/compromised host (SC-NFR-SEC-2) is that **anyone can
reproduce the exact deployed bundle from this public repo and confirm the
running build's commit**.

## Reproducing a release

```bash
git checkout <release-tag>          # the exact deployed commit
corepack enable
pnpm install --frozen-lockfile      # pnpm-lock.yaml pins every dep
pnpm build                          # → build/  (adapter-static output)
```

The build is deterministic for a given commit + lockfile. Deploy `build/`
verbatim (GitHub Pages or any static host — no code change, only the URL).

## Confirming which build is running

`svelte.config.js` derives `kit.version.name` from `git rev-parse --short
HEAD` (suffixed `-dirty` if the tree was modified). That single value
appears in two user-verifiable places:

- `<meta name="splitclone-build" content="<sha>">` in the served HTML
  (View Source).
- the Service Worker cache key `splitclone-<sha>` (DevTools → Application
  → Cache Storage).

Both must equal the released commit. A mismatch means the host served
something other than the tagged source.

## Subresource Integrity — scope and limitation

SC-ARC-HST-2 asks for SRI on host-loaded script/style tags. SplitClone is
an ES-module app: the entry is `<script type="module">` pulling a graph of
content-hashed dynamic `import()` / `modulepreload` chunks. The `integrity`
attribute is **not expressible across that dynamic graph** (it only covers
statically-listed tags), and SvelteKit/Vite emit no per-chunk SRI. Pulling
in a bundler plugin to synthesise it would violate the project's
anti-dependency posture (hand-rolled Graph/PKCE/IDB/SW) for a guarantee the
reproducible-build check already provides more strongly.

Mitigation actually shipped:

- **Reproducible build + commit pin** (above) — strictly stronger than SRI:
  it lets a user verify _all_ served bytes against public source, not just
  that a listed asset is unmodified.
- **Strict CSP** (`kit.csp`, hash mode): `script-src 'self'` with
  SvelteKit's own inline bootstrap hashed (no `'unsafe-inline'`),
  `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`.
  `connect-src` allows Microsoft Graph + login **and** the Microsoft
  content hosts Graph redirects file I/O to (`*.sharepoint.com`,
  `*.1drv.com`, `my.microsoftpersonalcontent.com`, `*.svc.ms`) —
  breadth there is an accepted weaker control; `script-src` stays
  locked, so a host that injects foreign script still cannot execute it.

Re-evaluating true per-chunk SRI is deferred to a tooling change that can
emit it without a runtime dependency (tracked alongside the other deferred
items in the SRS roadmap).
