# OneDrive setup (Phase 6)

The app works fully offline without this. OneDrive sync/sharing is enabled
only when an OAuth client id is configured. This is a one-time, free
registration in your own Microsoft account — no Azure subscription, no Apple
Developer Program, no server.

## Who does what (read this first)

The app registration in section 1 happens **exactly once for the whole
app — not once per person.** It produces a public **client id** (not a
secret) that is baked into the build and shared by every user. Each person
then signs in with **their own** Microsoft account; that per-user OAuth
consent is what grants access to *their own* OneDrive. The registration
only identifies the app — it never grants anyone access to anyone else's
files.

| Who | What they do |
| --- | --- |
| Whoever builds/deploys SplitClone | Sections 1 + 2, **once**. |
| Every user (ledger creator + everyone who joins) | Skip to section 3: **Connect OneDrive**, sign in, done. Nothing to register, no Azure account, no client id to copy. |

(If you both deploy *and* use it, you naturally do all of it — but still
only register once.)

## 1. Register the app — once, by whoever builds/deploys it (free)

1. Go to <https://entra.microsoft.com> → **App registrations** → **New
   registration**.
2. **Name:** anything, e.g. `SplitClone`.
3. **Supported account types:** *Personal Microsoft accounts only*
   (a OneDrive personal / family subscription is a personal MSA).
4. **Redirect URI:** platform **Single-page application (SPA)**. The app
   is served under the `/splitclone` base path (GitHub Pages project
   site), and `pnpm dev` mirrors that, so register **both**:
   `http://localhost:5173/splitclone/auth/callback` (dev) and the deployed
   `https://<you>.github.io/splitclone/auth/callback`. Keep both — don't
   replace localhost. This list is per *origin*, **not** per person — every
   user hitting the
   same deployed URL shares the same redirect URI, so you add one entry per
   place the app is served from, never one per user. It must match the URL
   the app is actually loaded from character-for-character (scheme, host,
   port, path, no trailing slash) or sign-in fails with
   `invalid_request: ... redirect_uri ... not valid`.
5. Create. **Do not** create a client secret — this is a public PKCE client.
6. **API permissions** → Add → Microsoft Graph → **Delegated** →
   `Files.ReadWrite` → Add. (That plus the implicit `offline_access`/`openid`
   is the entire scope the app ever requests. No mail/calendar/contacts.)
7. Copy the **Application (client) ID** from the overview page.

## 2. Configure the build

```bash
cp .env.example .env
# edit .env and set:
# PUBLIC_MS_CLIENT_ID=<the Application (client) ID>
```

Restart `pnpm dev`. A **Connect OneDrive** button now appears in a ledger's
Settings → Sync.

## 3. Sharing a ledger with other people

1. The creator connects OneDrive. The first change (or **Sync now**)
   creates `OneDrive/Apps/SplitClone/<ledgerId>/` with a plaintext
   `ledger.json` and the encrypted event segments. From Phase 7 on, sync is
   automatic: changes push within ~3 s (≤10 s budget, SC-FR-SYN-1) and a
   pull runs whenever the app is opened or refocused. **Sync now** still
   exists for an immediate forced cycle.
2. In OneDrive (web or app), the creator shares **either**:
   - the specific ledger folder `Apps/SplitClone/<ledgerId>` (the
     `<ledgerId>` is shown in the app under the ledger's **Settings →
     Ledger ID**), **or**
   - the whole `Apps/SplitClone` parent folder once — then every current
     and future ledger is joinable without sharing again.

   Give the other people's Microsoft accounts **edit** permission.
   Sharing a hand-made folder of some other name does nothing — it must
   be the app's actual `Apps/SplitClone` (or a `<ledgerId>` child of it).
3. Each other person: connect OneDrive in SplitClone, go to **Join a
   ledger**, paste the recovery code, tap **Join from OneDrive**. The app
   scans folders shared with their account — and one level inside each, so
   sharing the parent works — plus their own `Apps/SplitClone` (same-account
   multi-device needs no sharing), and adopts the folder whose metadata
   key-fingerprint matches the code (SC-ARC-ENC-3). No folder picker, no
   ledger id to copy — and, as above, **no app registration**: they only
   sign in with their own Microsoft account.
4. The joiner is then asked **“who are you in this ledger?”** — they pick an
   existing name the creator already added, or add themselves. This binds
   their device to one participant (SC-FR-PRT-2); it’s a one-time prompt per
   device per ledger.

## Security notes

- The folder contents are AES-256-GCM ciphertext; only `ledger.json` is
  plaintext and it carries nothing sensitive (no name/participants/labels).
- The recovery code is the only thing that decrypts a ledger. It travels
  out-of-band between people; the app never sends it anywhere.
- Tokens: access token in memory only; refresh token sealed with a
  per-origin non-extractable key before being stored (SC-NFR-SEC-2 —
  defence-in-depth, honestly weaker than a native app's keychain).

## Not yet (later phases)

- Camera QR scanning for the join code (paste works today).
- Internal-link `resolve()` base-path hardening — paired with the
  deploy/PWA phase, not OneDrive.
