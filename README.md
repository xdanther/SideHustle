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

AltStore PAL is not supported: MeloNX is not notarized, so it needs AltStore
Classic (or SideStore) signing with an Apple ID.

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
