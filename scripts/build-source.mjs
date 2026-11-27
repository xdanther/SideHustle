#!/usr/bin/env node
/**
 * Builds one AltStore Classic source.json that lists several apps.
 *
 *   node scripts/build-source.mjs            # rebuild from the committed snapshots
 *   node scripts/build-source.mjs --remote   # refresh both sources from their APIs first
 *
 * Sources:
 *   MeloNX   - Starforge (Forgejo) releases API; sits behind a Cloudflare bot
 *              challenge that rejects some datacenter IPs, so a committed
 *              snapshot is used when a live fetch fails.
 *   ByeTunes - GitHub releases API.
 *
 * Nothing outside the Node standard library is required.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE = {
  name: "MeloNX + ByeTunes",
  identifier: "com.xdanther.melonx.source",
  // Public URL this file is served from. Required by the AltStore source spec
  // (and by LiveContainer's parser), so it must match where the file really lives.
  sourceURL: "https://raw.githubusercontent.com/xdanther/SideHustle/main/source.json",
  iconURL: "https://melonx.org/logo.png",
  tintColor: "#6D4AD8",
  output: resolve(ROOT, "source.json"),
};

// MeloNX - values taken from the app itself:
//   CFBundleIdentifier = com.stossy11.MeloNX  (PRODUCT_BUNDLE_IDENTIFIER, MeloNX.xcodeproj)
//   IPHONEOS_DEPLOYMENT_TARGET = 15.0         (MeloNX app target)
//   entitlements = com.apple.developer.kernel.increased-memory-limit (MeloNX.entitlements)
const MELONX = {
  label: "MeloNX",
  apiUrl: "https://starforgejo.dev/api/v1/repos/projects/MeloNX/releases?limit=50",
  snapshot: resolve(ROOT, "data/releases.json"),
  bundleIdentifier: "com.stossy11.MeloNX",
  minOSVersion: "15.0",
  entitlements: ["com.apple.developer.kernel.increased-memory-limit"],
  iconURL: "https://melonx.org/logo.png",
  tintColor: "#6D4AD8",
  developerName: "stossy11",
  website: "https://melonx.org",
  releasesPage: "https://starforgejo.dev/projects/MeloNX/releases",
  discord: "https://discord.gg/HjCDPTpC3W",
};

// ByeTunes - values taken from the app itself:
//   CFBundleIdentifier = com.EduAlexxis.MusicManager  (PRODUCT_BUNDLE_IDENTIFIER)
//   IPHONEOS_DEPLOYMENT_TARGET = 16.0
const BYETUNES = {
  label: "ByeTunes",
  apiUrl: "https://api.github.com/repos/EduAlexxis/ByeTunes/releases?per_page=100",
  snapshot: resolve(ROOT, "data/byetunes.json"),
  bundleIdentifier: "com.EduAlexxis.MusicManager",
  minOSVersion: "16.0",
  iconURL:
    "https://raw.githubusercontent.com/EduAlexxis/ByeTunes/main/MusicManager/Assets.xcassets/AppIcon.appiconset/Icon-iOS-Default-1024x1024@1x.png",
  tintColor: "#FF375F",
  developerName: "EduAlexxis",
  website: "https://github.com/EduAlexxis/ByeTunes",
};

const MELONX_DESCRIPTION = [
  "MeloNX is an open-source Nintendo Switch emulator for iPhone and iPad,",
  "built on Ryujinx and written in C# and Swift.",
  "",
  "**This is an unofficial community source.** It only mirrors the .ipa files",
  "published on the official MeloNX releases page; it does not host, modify or",
  "repackage anything.",
  "",
  "Requirements:",
  "- MeloNX **requires JIT** and cannot run without it (e.g. StikDebug on iOS 26).",
  "- The *Increased Memory Limit* entitlement is required on all devices; the",
  "  *Extended Virtual Addressing* entitlement is required on iPhones with under",
  "  4 GB RAM and iPads with under 8 GB RAM.",
  "- Sideload with AltStore Classic, SideStore or another Apple ID sideloader.",
  "  AltStore PAL is not supported because the app is not notarized.",
  "- You must supply your own firmware, keys and game dumps. Piracy is not supported.",
].join("\n");

const BYETUNES_DESCRIPTION = [
  "ByeTunes adds music and ringtones straight to your device's media library,",
  "without syncing through iTunes on a computer.",
  "",
  "Features:",
  "- Direct music injection: add MP3, M4A, FLAC and WAV files to your Apple",
  "  Music library from the phone.",
  "- Playlist support, with smart playlists, pins for albums and artists, and",
  "  playlist covers.",
  "- Metadata fetched from iTunes or Deezer.",
  "",
  "Notes:",
  "- Requires iOS 16 or later.",
  "- Distributed by its author on GitHub; this entry only points at those",
  "  release files and does not host or modify them.",
].join("\n");

/** "2.0.0" for MeloNX releases titled like a version, otherwise the git tag. */
function melonxVersion(release) {
  const title = (release.name ?? "").trim();
  if (/^\d+(\.\d+)*$/.test(title)) return title;
  return release.tag_name.trim();
}

/** ByeTunes tags look like "v2.7" / "V2.2". */
function byetunesVersion(release) {
  return release.tag_name.trim().replace(/^v/i, "");
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function fetchJson(url, source) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": `altstore-multi-source/1.0 (+https://github.com/xdanther/SideHustle)`,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${source} releases API`);
  const releases = await response.json();
  if (!Array.isArray(releases) || releases.length === 0) {
    throw new Error(`${source} releases API returned no releases`);
  }
  return releases;
}

async function loadReleases(source, useRemote) {
  if (useRemote) {
    try {
      const releases = await fetchJson(source.apiUrl, source.label);
      await writeFile(source.snapshot, `${JSON.stringify(releases, null, 2)}\n`);
      console.log(`Fetched ${releases.length} ${source.label} releases from ${source.apiUrl}`);
      return releases;
    } catch (error) {
      console.warn(
        `Live fetch for ${source.label} failed (${error.message}); using committed snapshot.`,
      );
    }
  }
  return JSON.parse(await readFile(source.snapshot, "utf8"));
}

/** ByeTunes ships debug builds next to the real one; prefer the plain name. */
function pickByeTunesIpa(release) {
  const assets = (release.assets ?? []).filter((asset) => /\.ipa$/i.test(asset.name ?? ""));
  return (
    assets.find((asset) => asset.name.toLowerCase() === "byetunes.ipa") ??
    assets.find((asset) => !/debug/i.test(asset.name)) ??
    assets[0]
  );
}

function buildVersions(releases, source, { versionFor, pickAsset }) {
  const versions = [];

  for (const release of releases) {
    if (release.draft || release.prerelease) continue;

    const ipa = pickAsset(release);
    if (!ipa) continue;

    const date = release.published_at ?? release.created_at;
    const version = versionFor(release);
    const size = Number(ipa.size);

    const entry = {
      version,
      date,
      localizedDescription: (release.body ?? "").trim() || `${source.label} ${version}`,
      downloadURL: ipa.browser_download_url ?? ipa.download_url,
      size,
      minOSVersion: source.minOSVersion,
    };

    if (!Number.isInteger(size) || size <= 0) throw new Error(`Bad size for ${version}`);
    if (!/^\d+(\.\d+)*$/.test(version)) throw new Error(`Bad version string: ${version}`);
    if (Number.isNaN(Date.parse(date))) throw new Error(`Bad date for ${version}: ${date}`);
    if (!/^https:\/\//.test(entry.downloadURL)) throw new Error(`Bad downloadURL for ${version}`);

    versions.push(entry);
  }

  versions.sort((a, b) => {
    const byDate = Date.parse(b.date) - Date.parse(a.date);
    return byDate !== 0 ? byDate : compareVersions(b.version, a.version);
  });

  // AltStore requires unique versions; keep the newest release for each one.
  const seen = new Set();
  const unique = versions.filter((entry) => {
    if (seen.has(entry.version)) {
      console.warn(`Skipping duplicate ${source.label} version ${entry.version}`);
      return false;
    }
    seen.add(entry.version);
    return true;
  });

  if (unique.length === 0) throw new Error(`No .ipa releases found for ${source.label}`);
  return unique;
}

function melonxApp(versions) {
  return {
    name: "MeloNX",
    bundleIdentifier: MELONX.bundleIdentifier,
    developerName: MELONX.developerName,
    subtitle: "Nintendo Switch emulator for iPhone and iPad",
    localizedDescription: [
      "MeloNX enables Nintendo Switch game emulation on iOS, using Ryujinx as a base.",
      "",
      "**MeloNX requires JIT** to run. Enable it with your preferred method",
      "(on iOS 26, StikDebug is required).",
      "",
      "Notes:",
      "- An *Increased Memory Limit* entitlement is required on all devices, and",
      "  *Extended Virtual Addressing* is required on iPhones under 4 GB RAM and",
      "  iPads under 8 GB RAM. Depending on your sideloading setup you may need a",
      "  paid developer account or TrollStore for these.",
      "- Recommended iPhone: 15 Pro or newer. Recommended iPad: iPad Pro 5th gen",
      "  (8 GB) or iPad Air 5 or newer.",
      "- MeloNX does not ship games, keys or firmware. Dump your own.",
      "",
      `Source code: ${MELONX.releasesPage}`,
      `Discord: ${MELONX.discord}`,
    ].join("\n"),
    iconURL: MELONX.iconURL,
    tintColor: MELONX.tintColor,
    category: "entertainment",
    versions,
    appPermissions: { entitlements: MELONX.entitlements },
  };
}

function byetunesApp(versions) {
  return {
    name: "ByeTunes",
    bundleIdentifier: BYETUNES.bundleIdentifier,
    developerName: BYETUNES.developerName,
    subtitle: "Add music to your iPhone without iTunes",
    localizedDescription: BYETUNES_DESCRIPTION,
    iconURL: BYETUNES.iconURL,
    tintColor: BYETUNES.tintColor,
    category: "music",
    versions,
    website: BYETUNES.website,
  };
}

function buildSource(melonxVersions, byetunesVersions) {
  return {
    name: SOURCE.name,
    identifier: SOURCE.identifier,
    sourceURL: SOURCE.sourceURL,
    subtitle: "MeloNX and ByeTunes, from their official releases",
    description: [
      "One source for two sideloaded iOS apps:",
      "",
      "- **MeloNX** - Nintendo Switch emulator for iPhone and iPad.",
      "- **ByeTunes** - add music to your media library without iTunes.",
      "",
      "**This is an unofficial community source.** Each app entry only points at",
      "the .ipa files its own developers publish; nothing is re-hosted or modified.",
      "",
      "MeloNX requires JIT and the memory entitlements described on its app page.",
      "ByeTunes needs iOS 16 or later.",
    ].join("\n"),
    iconURL: SOURCE.iconURL,
    headerURL: SOURCE.iconURL,
    website: MELONX.website,
    tintColor: SOURCE.tintColor,
    nsfw: false,
    featuredApps: [MELONX.bundleIdentifier, BYETUNES.bundleIdentifier],
    apps: [melonxApp(melonxVersions), byetunesApp(byetunesVersions)],
    news: [],
  };
}

function validate(source) {
  const problems = [];

  for (const key of ["name", "identifier", "sourceURL"]) {
    if (!source[key]) problems.push(`source.${key} is missing`);
  }
  if (!Array.isArray(source.apps) || source.apps.length === 0) {
    problems.push("source.apps is empty");
    throw new Error(`Source validation failed:\n- ${problems.join("\n- ")}`);
  }

  const bundleIdentifiers = new Set();
  for (const app of source.apps) {
    for (const key of ["name", "bundleIdentifier", "developerName", "localizedDescription", "iconURL"]) {
      if (!app[key]) problems.push(`${app.name ?? "app"}.${key} is missing`);
    }
    if (bundleIdentifiers.has(app.bundleIdentifier)) {
      problems.push(`duplicate app ${app.bundleIdentifier}`);
    }
    bundleIdentifiers.add(app.bundleIdentifier);

    if (!Array.isArray(app.versions) || app.versions.length === 0) {
      problems.push(`${app.name} has no versions`);
      continue;
    }

    const versions = new Set();
    for (const entry of app.versions) {
      for (const key of ["version", "date", "downloadURL", "size"]) {
        if (entry[key] === undefined || entry[key] === "") {
          problems.push(`${app.name} ${entry.version ?? "?"} is missing ${key}`);
        }
      }
      if (versions.has(entry.version)) problems.push(`duplicate ${app.name} version ${entry.version}`);
      versions.add(entry.version);
      if (!Number.isInteger(entry.size) || entry.size <= 0) {
        problems.push(`${app.name} ${entry.version} has an invalid size`);
      }
      if (!/^https:\/\//.test(String(entry.downloadURL))) {
        problems.push(`${app.name} ${entry.version} has an invalid downloadURL`);
      }
    }
  }

  if (problems.length > 0) throw new Error(`Source validation failed:\n- ${problems.join("\n- ")}`);
}

const useRemote = process.argv.includes("--remote");

const melonxReleases = await loadReleases(MELONX, useRemote);
const byetunesReleases = await loadReleases(BYETUNES, useRemote);

const melonxVersions = buildVersions(melonxReleases, MELONX, {
  versionFor: melonxVersion,
  pickAsset: (release) => (release.assets ?? []).find((asset) => /\.ipa$/i.test(asset.name ?? "")),
});
const byetunesVersions = buildVersions(byetunesReleases, BYETUNES, {
  versionFor: byetunesVersion,
  pickAsset: pickByeTunesIpa,
});

const source = buildSource(melonxVersions, byetunesVersions);
validate(source);
await writeFile(SOURCE.output, `${JSON.stringify(source, null, 2)}\n`);

for (const app of source.apps) {
  const latest = app.versions[0];
  console.log(
    `${app.name}: ${app.versions.length} versions, latest ${latest.version} ` +
      `(${(latest.size / 1024 / 1024).toFixed(1)} MiB, ${latest.date})`,
  );
}
console.log(`Wrote ${SOURCE.output}`);
