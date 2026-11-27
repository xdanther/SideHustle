# MeloNX + ByeTunes — AltStore source

One [AltStore Classic](https://faq.altstore.io/developers/make-a-source) source
for two apps, so both can be installed and updated from AltStore, SideStore or
LiveContainer:

| App | Releases | Bundle ID |
| --- | --- | --- |
| **MeloNX** — Nintendo Switch emulator | [starforgejo.dev/projects/MeloNX/releases](https://starforgejo.dev/projects/MeloNX/releases) | `com.stossy11.MeloNX` |
| **ByeTunes** — add music without iTunes | [github.com/EduAlexxis/ByeTunes/releases](https://github.com/EduAlexxis/ByeTunes/releases) | `com.EduAlexxis.MusicManager` |

This is an unofficial community source. It only points at the `.ipa` files each
app's own developers publish; nothing is re-hosted or modified.

## Add the source

Source URL:

```
https://raw.githubusercontent.com/xdanther/SideHustle/main/source.json
```

- **AltStore / SideStore:** Sources → **+** → paste the URL above.
- Or tap: `altstore://source?url=https://raw.githubusercontent.com/xdanther/SideHustle/main/source.json`
- **LiveContainer:** Sources → **+** → paste the same URL, or tap
  `livecontainer://source?url=https://raw.githubusercontent.com/xdanther/SideHustle/main/source.json`

Use the `raw.githubusercontent.com` URL exactly as written. The GitHub *file
page* URL (`github.com/.../blob/main/source.json`) returns HTML, and
`data/releases.json` is a raw API snapshot, not a source — either one fails with
"Unable to refresh this source" / "the source file is not valid".

AltStore PAL is not supported: MeloNX is not notarized, so it needs AltStore
Classic (or SideStore) signing with an Apple ID.

## Installing in LiveContainer / AltStore (read this first)

**ByeTunes installs normally** — its `.ipa` files are GitHub release assets, and
GitHub serves those to any client.

**MeloNX does not install from inside the app**: its `.ipa` files live on
`starforgejo.dev`, which puts every request that is not a real browser behind
Anubis (JavaScript proof-of-work) and Cloudflare's "Just a moment" challenge. A
sideloader downloads with a plain HTTP client, gets that challenge page instead
of the file, and reports `Please provide an IPA file to install.` or a
decompression failure. This affects AltStore, SideStore and LiveContainer
equally, and no URL or header variation avoids it.

Workaround for MeloNX:

1. Open https://starforgejo.dev/projects/MeloNX/releases in Safari and download
   the `.ipa` (the browser solves the challenge).
2. In LiveContainer go to **Apps → (+) → Install IPA File**, then pick the
   downloaded file from Files → Downloads.

A one-click install would need the IPA re-hosted somewhere that serves plain
HTTP downloads, such as a GitHub release in this repository; the source can be
pointed at that mirror.

## Before you install

- MeloNX **requires JIT**; it will not run without it (StikDebug on iOS 26).
- The *Increased Memory Limit* entitlement is required on all devices, and
  *Extended Virtual Addressing* is required on iPhones under 4 GB RAM and iPads
  under 8 GB RAM. Some setups need a paid developer account or TrollStore.
- Bring your own firmware, keys and game dumps. Piracy is not supported.

## How it works

| File | Purpose |
| --- | --- |
| `source.json` | The generated AltStore source. Do not edit by hand. |
| `scripts/build-source.mjs` | Builds `source.json` from both apps' release APIs. |
| `data/releases.json` | MeloNX snapshot of the last successful API response. |
| `data/byetunes.json` | ByeTunes snapshot of the last successful API response. |
| `.github/workflows/update-source.yml` | Runs every 6 hours and on demand: refreshes both apps and commits `source.json` with the latest versions in the message, so a new release shows up within a few hours. |

Fields that cannot come from the release list are taken from each app itself:

- MeloNX: `com.stossy11.MeloNX` (`PRODUCT_BUNDLE_IDENTIFIER`), iOS 15.0
  (`IPHONEOS_DEPLOYMENT_TARGET`), the
  `com.apple.developer.kernel.increased-memory-limit` entitlement
  (`MeloNX.entitlements`).
- ByeTunes: `com.EduAlexxis.MusicManager` (`PRODUCT_BUNDLE_IDENTIFIER`),
  iOS 16.0 (`IPHONEOS_DEPLOYMENT_TARGET`), icon from the app's
  `Assets.xcassets` in its repository. Debug builds (`*-Debug.ipa`) are skipped
  so the release build is the one installed.

### Local rebuild

```sh
node scripts/build-source.mjs            # rebuild from the committed snapshots
node scripts/build-source.mjs --remote   # refresh both sources first
```

The MeloNX releases API is behind a Cloudflare bot challenge that rejects some
datacenter IPs. When its `--remote` fetch fails, the script warns and falls back
to the committed snapshot, so the workflow never produces a broken source (the
ByeTunes API on GitHub is fetched normally). The script validates the result
(required AltStore keys, unique versions per app, valid dates, sizes and
`https` download URLs) and exits non-zero on bad data.
