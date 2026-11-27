# MeloNX — AltStore source

An [AltStore Classic](https://faq.altstore.io/developers/make-a-source) source that
mirrors the official **MeloNX** releases
([starforgejo.dev/projects/MeloNX/releases](https://starforgejo.dev/projects/MeloNX/releases))
so MeloNX can be installed and updated straight from AltStore / SideStore.

This is an unofficial community mirror. It only points at the `.ipa` files the
MeloNX team publishes; nothing is re-hosted or modified.

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

The catalog works, but **installing from inside the app does not**: the `.ipa`
files live on `starforgejo.dev`, which puts every request that is not a real
browser behind Anubis (JavaScript proof-of-work) and Cloudflare's "Just a
moment" challenge. A sideloader downloads with a plain HTTP client, gets that
challenge page instead of the file, and reports `Please provide an IPA file to
install.` or a decompression failure. This affects AltStore, SideStore and
LiveContainer equally, and no URL or header variation avoids it.

Workaround that works today:

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
| `scripts/build-source.mjs` | Builds `source.json` from the Forgejo releases API. |
| `data/releases.json` | Snapshot of the last successful API response. |
| `.github/workflows/update-source.yml` | Scheduled job that refreshes and commits `source.json`. |

Fields that cannot come from the release list are taken from the app itself:
`com.stossy11.MeloNX` (`PRODUCT_BUNDLE_IDENTIFIER`), iOS 15.0
(`IPHONEOS_DEPLOYMENT_TARGET`) and the
`com.apple.developer.kernel.increased-memory-limit` entitlement
(`MeloNX.entitlements`).

### Local rebuild

```sh
node scripts/build-source.mjs            # rebuild from data/releases.json
node scripts/build-source.mjs --remote   # refresh from the API first
```

The releases API is behind a Cloudflare bot challenge that rejects some
datacenter IPs. When `--remote` fails, the script warns and falls back to the
committed snapshot, so the workflow never produces a broken source. The script
validates the result (required AltStore keys, unique versions, valid dates,
sizes and download URLs) and exits non-zero on bad data.
