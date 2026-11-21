# Mail

A Windows desktop mail client (Electron + React) for IMAP/SMTP accounts, with a
unified inbox and a built-in disposable-mail tab.

Everything runs on the PC: the app connects straight to each provider's IMAP
and SMTP servers. Accounts are kept in the app's data folder
(`%APPDATA%\Mail\mail-data\accounts.json`), with passwords encrypted by Windows
(DPAPI via Electron `safeStorage`). There is no server component.

## Layout

- `electron/main.cjs`: window, auto-updater, IPC hookup
- `electron/backend.cjs`: the mail backend (IMAP fetch/move/flags, SMTP send, account store, offline cache)
- `electron/preload.cjs`: exposes `window.electron.mailApi()` to the page
- `src/components/mail-app/use-mail.ts`: app state; calls the backend over IPC

## Develop

```bash
npm install
npm run dev        # renderer on http://localhost:5173
npm run electron   # in a second terminal (NODE_ENV=development loads the dev server)
```

## Release

Releases are built by GitHub Actions (`.github/workflows/release.yml`) on a
version tag, and installed copies update themselves from GitHub Releases.

```bash
# bump "version" in package.json first
git commit -am "Mail 1.2.1" && git tag v1.2.1 && git push origin main --tags
```

Outlook.com / Hotmail personal accounts need OAuth sign-in, which isn't built
yet; password login is refused by Microsoft.
