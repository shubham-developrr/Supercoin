# SuperCoin Vault

Offline-first Flipkart SuperCoins / Shopsy 7-day streak / GoSats tracker for 11 accounts — Apple Cupertino Dark Bento UI, 100% on-device storage.

## What it is

A standalone mobile web app (PWA) wrapped with [Capacitor](https://capacitorjs.com/) so it can be compiled into a real Android APK. All data — balances, pending coins, Shopsy streaks, GoSats status, vault details (phone, number, PAN, notes), and transaction history — lives in **IndexedDB on the device**. Nothing is sent anywhere.

## Features

- **11 seed accounts** exactly as specified (Riya Bhabhi, 9169, 630650, 7355, Dadi, 8056, 9956, 8562921546, Papa, BSNL, M2 Pro) — seeded only on first launch; user edits are never overwritten.
- **Bento grid cards**: #ID badge, alias (hideable), glowing GoSats Active/Inactive pill that toggles directly on the card, big tabular balance, +/− quick loggers, Shopsy 7-day capsule with 7 tappable segments + +1d/Reset, Coming / Expiring footer pills.
- **Sticky top bar**: X/11 GoSats Active pill, Hide/Show Names, Activity Log, Vault Directory, Backup/Restore.
- **3-metric bento row**: Active Coins (+gained/−used), Coming Soon + Projected, Expiring with nearest-expiry alert.
- **Natural language command bar** (100% offline, no API key): *"Riya bhabhi 457 pending credited"*, *"M2 Pro Shopsy day 4"*, *"8056 GoSats Active"*, *"Dadi used 48 coins"*, *"Papa +50"*. Optional Gemini API key field stored locally for complex sentences.
- **Undo** after every change.
- **Account modal** (3 tabs): Vault Details (GoSats switch, phone/device, mobile number, PAN holder, name, notes), Coins & Expiry (balance, pending, expiring, expiry date, 0–7d streak chips, "Move pending → active"), History.
- **Vault Directory**: full table of all accounts with hidden details, tap a row to edit.
- **Activity Log**: global gained/used history across all accounts.
- **Backup / Restore**: copy JSON to clipboard, paste JSON to restore, export/import `.json` backup files.
- **Add / delete accounts** beyond the original 11.
- **Offline-first PWA**: service worker caches the app; works without internet; installable to home screen.

## Files

| File | Purpose |
|------|---------|
| `index.html` | App shell + all modals |
| `css/app.css` | Cupertino Dark Bento design system |
| `js/db.js` | IndexedDB storage + exact 11-account seed |
| `js/parser.js` | Offline natural-language command parser |
| `js/app.js` | App controller, rendering, mutations, undo |
| `manifest.json` | PWA manifest |
| `sw.js` | Offline service worker |
| `capacitor.config.ts` | Capacitor config (APK wrapper) |
| `package.json` | Scripts + Capacitor deps |

## Build the APK

This repo is configured as a Capacitor Android project. All requirements are imported:

- `capacitor.config.json` — app id `com.supercoin.vault`, web assets in `www/`
- `@capacitor/android`, `@capacitor/core`, `@capacitor/cli` installed
- Android platform added (`android/`) with Gradle wrapper; web assets synced to `android/app/src/main/assets/www`

### 1. Install dependencies
```bash
npm install
```

### 2. Add & sync the Android platform
```bash
npx cap add android      # adds the native Android project
npx cap sync android     # copies www/ assets into the app
```

### 3. Build the APK (requires Android Studio / Java SDK)
The sandbox has no Java or Android SDK, so compile on a machine with Android Studio:

```bash
npx cap open android
```

Then in Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.  
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Without Android Studio (PWA)
Serve the `www/` folder in any browser and "Add to Home Screen" — it runs offline and stores everything on-device via IndexedDB:
```bash
cd www && npx http-server . -p 8080
```

### Files
| File | Purpose |

## Data safety

- First launch: seed accounts written to IndexedDB only if the store is empty.
- Every mutation is persisted immediately; an undo snapshot is kept so the last change can be reverted.
- JSON backup/restore lets you move data between phones or recover after a reset.

## Built with

Vanilla HTML/CSS/JS (no build step), IndexedDB, Capacitor.
