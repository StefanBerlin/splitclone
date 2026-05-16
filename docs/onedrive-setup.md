# OneDrive setup (Phase 6)

The app works fully offline without this. OneDrive sync/sharing is enabled
only when an OAuth client id is configured. This is a one-time, free
registration in your own Microsoft account — no Azure subscription, no Apple
Developer Program, no server.

## 1. Register the app (free)

1. Go to <https://entra.microsoft.com> → **App registrations** → **New
   registration**.
2. **Name:** anything, e.g. `SplitClone`.
3. **Supported account types:** *Personal Microsoft accounts only*
   (a OneDrive personal / family subscription is a personal MSA).
4. **Redirect URI:** platform **Single-page application (SPA)**, value
   `http://localhost:5173/auth/callback` for local dev. Add your deployed
   URL later too, e.g. `https://<you>.github.io/splitclone/auth/callback`.
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

1. The creator connects OneDrive and runs **Sync now** once — this creates
   `OneDrive/Apps/SplitClone/<ledgerId>/` with a plaintext `ledger.json`
   and the encrypted event segments.
2. In OneDrive (web or app), the creator **shares that ledger folder** with
   the other people's Microsoft accounts (edit permission).
3. Each other person: connect OneDrive in SplitClone, go to **Join a
   ledger**, paste the recovery code, tap **Join from OneDrive**. The app
   scans folders shared with their account and adopts the one whose
   metadata key-fingerprint matches the code (SC-ARC-ENC-3). No folder
   picker, no ledger id to copy.

## Security notes

- The folder contents are AES-256-GCM ciphertext; only `ledger.json` is
  plaintext and it carries nothing sensitive (no name/participants/labels).
- The recovery code is the only thing that decrypts a ledger. It travels
  out-of-band between people; the app never sends it anywhere.
- Tokens: access token in memory only; refresh token sealed with a
  per-origin non-extractable key before being stored (SC-NFR-SEC-2 —
  defence-in-depth, honestly weaker than a native app's keychain).

## Not yet (later phases)

- Automatic/background sync on focus + 10 s debounce (Phase 7; Phase 6 is
  manual **Sync now**).
- Camera QR scanning for the join code (paste works today).
- Internal-link `resolve()` base-path hardening — paired with the
  deploy/PWA phase, not OneDrive.
