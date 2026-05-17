# SplitClone

**Split shared expenses with friends, family, or flatmates — without a server.**

SplitClone is a privacy-first web app for tracking who paid for what in a group
and who owes whom. It works like a typical shared-expenses app, but there is **no
backend and no company in the middle**: your data lives encrypted in _your own_
OneDrive folder, and sharing a ledger means sharing that folder. SplitClone is a
static website (installable as a PWA) that reads and writes those files directly
from your browser.

- 🔒 **End-to-end encrypted.** Everything is AES-256-GCM ciphertext in your
  OneDrive. The only plaintext file carries no names, amounts, or participants.
- ☁️ **Your storage, your account.** No SplitClone server ever sees your data.
  Sync and sharing ride entirely on OneDrive.
- 📵 **Offline-first.** Installable to your home screen; works on a plane and
  syncs when you're back online.
- 🧾 **The usual essentials.** Expenses, flexible splits, settlements, running
  balances, labels/filters, and a CSV export.

## Live site

- **App:** <https://stefanberlin.github.io/splitclone/>
- **Specification (SRS):** <https://stefanberlin.github.io/splitclone/srs/> —
  the full requirements document (StrictDoc), published from
  [`docs/requirements.sdoc`](docs/requirements.sdoc) on every deploy.

---

## What you can do

- **Create a ledger** for a group (a trip, a household, a project).
- **Add expenses** — who paid, how much, who it's split between, with labels.
- **Record settlements** when someone pays someone back.
- **See balances** — a clear summary of what you owe and what you're owed.
- **Filter and export** by participant, date range, or label to CSV.
- **Share a ledger** with others by sharing the OneDrive folder; everyone's
  changes merge automatically.
- **Multi-device** — open the same ledger on your phone and your PC.

Each ledger has a **recovery code**: a secret string that decrypts it. Anyone
with the shared folder _and_ the recovery code can read and contribute to the
ledger. Without the code, the files are unreadable — even to Microsoft.

---

## Do I need a OneDrive account?

**To use the app at all? No.** SplitClone runs fully offline and local-only out
of the box: create ledgers, add expenses, see balances. Nothing leaves your
device. But that data then lives **only on that one device/browser** — no
backup, no second device, no sharing.

**To sync across devices or share with other people? Yes — a Microsoft account
with OneDrive is required for everyone who participates.** A free personal
Microsoft account (the kind behind a OneDrive personal or Microsoft 365 family
subscription) is enough. No Azure subscription, no paid plan needed.

There are **two different roles**, and most people only need the second one:

| You are…                                                       | What you need to do                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Just using a SplitClone someone deployed** (the common case) | Nothing to register. Open the site, tap **Connect OneDrive**, sign in with your own Microsoft account. Done.         |
| **Deploying your own copy of SplitClone**                      | A one-time, free app registration in _your_ Microsoft account so the app is allowed to talk to OneDrive (see below). |

The app registration is done **once for the whole deployment**, not once per
user. It only identifies the app — it never grants anyone access to anyone
else's files. Each person's own sign-in is what grants access to their own
OneDrive.

---

## Setting up OneDrive

### A. For users — connecting and sharing

1. Open SplitClone and create or open a ledger.
2. Go to the ledger's **Settings → Sync** and tap **Connect OneDrive**.
3. Sign in with your Microsoft account and approve access. SplitClone requests
   **only** the `Files.ReadWrite` permission — no mail, calendar, or contacts.
4. Your first change creates `OneDrive/Apps/SplitClone/<ledgerId>/`. Syncing is
   automatic from then on (a manual **Sync now** also exists).

**To share a ledger with other people:**

1. The creator connects OneDrive (steps above), so the folder exists.
2. In OneDrive (web or app), the creator shares **one** of these with the other
   people's Microsoft accounts, with **edit** permission:
   - the specific ledger folder `Apps/SplitClone/<ledgerId>` — the
     `<ledgerId>` is shown in the app under **Settings → Ledger ID**, or
   - the whole `Apps/SplitClone` folder once — then every current and future
     ledger is shareable without sharing again.
3. The creator passes the ledger's **recovery code** to the others through a
   trusted channel (in person, a secure message) — **never inside the OneDrive
   folder itself**. The recovery code is the secret that decrypts the ledger.
4. Each other person: in SplitClone, **Connect OneDrive**, sign in with **their
   own** account, go to **Join a ledger**, paste the recovery code, and tap
   **Join from OneDrive**. The app finds the matching folder automatically —
   no folder picker, no ledger ID to copy.
5. On first join, each person picks who they are in the ledger (an existing
   name, or adds themselves). That's a one-time prompt per device.

> Same Microsoft account on multiple devices needs **no** sharing at all — just
> connect OneDrive on each device and the ledgers appear.

### B. For deployers — registering the app (one-time, free)

Skip this if you're just using a copy someone else hosts.

1. Go to <https://entra.microsoft.com> → **App registrations** → **New
   registration**.
2. **Name:** anything, e.g. `SplitClone`.
3. **Supported account types:** _Personal Microsoft accounts only_.
4. **Redirect URI:** platform **Single-page application (SPA)**. The app is
   served under a `/splitclone` base path, and `pnpm dev` mirrors that, so add
   **both** of these (keep localhost — don't replace it):
   - `http://localhost:5173/splitclone/auth/callback` (local dev)
   - `https://<your-deployed-host>/splitclone/auth/callback` (production)

   It must match the URL the app is actually loaded from
   character-for-character or sign-in fails.

5. Create it. **Do not** create a client secret — this is a public PKCE client.
6. **API permissions** → Add → Microsoft Graph → **Delegated** →
   `Files.ReadWrite` → Add.
7. Copy the **Application (client) ID** from the overview page.
8. Configure the build:
   ```bash
   cp .env.example .env
   # edit .env and set:
   # PUBLIC_MS_CLIENT_ID=<the Application (client) ID>
   ```

The client id is **public** (not a secret) and is baked into the static build,
shared by every user of that deployment.

There's a more detailed walkthrough in [docs/onedrive-setup.md](docs/onedrive-setup.md).

---

## Running it yourself

Requires **Node ≥ 22.13** and **pnpm 11** (via Corepack: `corepack enable`).

```bash
pnpm install
pnpm dev          # http://localhost:5173/splitclone/
```

```bash
pnpm build         # static site into build/
pnpm preview       # serve the production build locally
```

```bash
pnpm test          # unit (Vitest) + e2e (Playwright)
pnpm lint          # prettier + eslint
pnpm check         # svelte-check / typecheck
```

The build output in `build/` is a plain static site — host it on GitHub Pages,
any static webspace, or a CDN. It is currently configured for the `/splitclone`
base path (a GitHub Pages project site); change `kit.paths.base` in
[svelte.config.js](svelte.config.js) if you host it elsewhere, and update the
OAuth redirect URI to match.

---

## How it works (briefly)

Each device keeps an append-only event log per ledger in IndexedDB. Logs are
encrypted and written as files to the shared OneDrive folder. Every device
reads everyone's logs and **deterministically merges** them into the same
ledger state — there is no server arbitrating, and edits made offline merge
cleanly once back online. See [docs/architecture.md](docs/architecture.md) for
the full design and [docs/requirements.sdoc](docs/requirements.sdoc) for the
requirements.

**Privacy:** SplitClone has no analytics, no tracking, no SplitClone-operated
server. The OAuth access token stays in memory; the refresh token is sealed
with a per-origin non-extractable key. Microsoft sees encrypted blobs in your
own OneDrive and nothing else.

---

## License

Released into the public domain (Unlicense). See [LICENSE](LICENSE).
