#!/usr/bin/env node
/**
 * Builds an AltStore Classic source.json for MeloNX from the official
 * Starforge (Forgejo) releases API.
 *
 *   node scripts/build-source.mjs            # rebuild from data/releases.json snapshot
 *   node scripts/build-source.mjs --remote   # refresh from the Forgejo API, then rebuild
 *
 * The release API sits behind a Cloudflare bot challenge that rejects some
 * datacenter IPs, so a committed snapshot is used when a live fetch fails.
 * Nothing outside the Node standard library is required.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CONFIG = {
  // Official releases (Forgejo API, same data the releases page renders).
  apiUrl: "https://starforgejo.dev/api/v1/repos/projects/MeloNX/releases?limit=50",
  snapshot: resolve(ROOT, "data/releases.json"),
  output: resolve(ROOT, "source.json"),
  // Public URL this file is served from. Required by the AltStore source spec
  // (and by LiveContainer's parser), so it must match where the file really lives.
  sourceURL: "https://raw.githubusercontent.com/xdanther/SideHustle/main/source.json",
  identifier: "com.xdanther.melonx.source",

  // Values taken from the app itself:
  //   CFBundleIdentifier = com.stossy11.MeloNX  (PRODUCT_BUNDLE_IDENTIFIER, MeloNX.xcodeproj)
  //   IPHONEOS_DEPLOYMENT_TARGET = 15.0         (MeloNX app target)
  //   entitlements = com.apple.developer.kernel.increased-memory-limit (MeloNX.entitlements)
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

const DESCRIPTION = [
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

/** "2.0.0" for releases titled like a version, otherwise the git tag. */
function versionFor(release) {
  const title = (release.name ?? "").trim();
  if (/^\d+(\.\d+)*$/.test(title)) return title;
  return release.tag_name.trim();
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

async function loadReleases(useRemote) {
  if (useRemote) {
    try {
      const response = await fetch(CONFIG.apiUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "melonx-altstore-source/1.0 (+https://github.com/xdanther/SideHustle)",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} from releases API`);
      const releases = await response.json();
      if (!Array.isArray(releases) || releases.length === 0) {
        throw new Error("releases API returned no releases");
      }
      await writeFile(CONFIG.snapshot, `${JSON.stringify(releases, null, 2)}\n`);
      console.log(`Fetched ${releases.length} releases from ${CONFIG.apiUrl}`);
      return releases;
    } catch (error) {
      console.warn(`Live fetch failed (${error.message}); using committed snapshot.`);
    }
  }
  return JSON.parse(await readFile(CONFIG.snapshot, "utf8"));
}

function buildVersions(releases) {
  const versions = [];

  for (const release of releases) {
    if (release.draft || release.prerelease) continue;

    const ipa = (release.assets ?? []).find((asset) => /\.ipa$/i.test(asset.name ?? ""));
    if (!ipa) continue;

    const date = release.published_at ?? release.created_at;
    const version = versionFor(release);
    const size = Number(ipa.size);

    const entry = {
      version,
      date,
      localizedDescription: (release.body ?? "").trim() || `MeloNX ${version}`,
      downloadURL: ipa.browser_download_url,
      size,
      minOSVersion: CONFIG.minOSVersion,
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
      console.warn(`Skipping duplicate version ${entry.version} (keeping newest)`);
      return false;
    }
    seen.add(entry.version);
    return true;
  });

  if (unique.length === 0) throw new Error("No .ipa releases found");
  return unique;
}

function buildSource(versions) {
  return {
    name: "MeloNX",
    identifier: CONFIG.identifier,
    sourceURL: CONFIG.sourceURL,
    subtitle: "Nintendo Switch emulation for iOS, from the official MeloNX releases",
    description: DESCRIPTION,
    iconURL: CONFIG.iconURL,
    headerURL: CONFIG.iconURL,
    website: CONFIG.website,
    tintColor: CONFIG.tintColor,
    nsfw: false,
    featuredApps: [CONFIG.bundleIdentifier],
    apps: [
      {
        name: "MeloNX",
        bundleIdentifier: CONFIG.bundleIdentifier,
        developerName: CONFIG.developerName,
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
          `Source code: ${CONFIG.releasesPage}`,
          `Discord: ${CONFIG.discord}`,
        ].join("\n"),
        iconURL: CONFIG.iconURL,
        tintColor: CONFIG.tintColor,
        category: "entertainment",
        versions,
        appPermissions: {
          entitlements: CONFIG.entitlements,
        },
      },
    ],
    news: [],
  };
}

function validate(source) {
  const app = source.apps[0];
  const problems = [];

  for (const key of ["name", "identifier", "sourceURL"]) {
    if (!source[key]) problems.push(`source.${key} is missing`);
  }
  if (!Array.isArray(source.apps) || source.apps.length === 0) {
    problems.push("source.apps is empty");
  }
  if (source.apps.length !== 1) problems.push("expected exactly one app");
  for (const key of ["bundleIdentifier", "developerName", "localizedDescription", "iconURL"]) {
    if (!app[key]) problems.push(`app.${key} is missing`);
  }
  if (!Array.isArray(app.versions) || app.versions.length === 0) {
    problems.push("app.versions is empty");
  }

  const versions = new Set();
  for (const entry of app.versions ?? []) {
    for (const key of ["version", "date", "downloadURL", "size"]) {
      if (entry[key] === undefined || entry[key] === "") {
        problems.push(`version ${entry.version ?? "?"} is missing ${key}`);
      }
    }
    if (versions.has(entry.version)) problems.push(`duplicate version ${entry.version}`);
    versions.add(entry.version);
    if (!Number.isInteger(entry.size) || entry.size <= 0) {
      problems.push(`version ${entry.version} has an invalid size`);
    }
  }

  if (problems.length > 0) throw new Error(`Source validation failed:\n- ${problems.join("\n- ")}`);
}

const useRemote = process.argv.includes("--remote");
const releases = await loadReleases(useRemote);
const versions = buildVersions(releases);
const source = buildSource(versions);
validate(source);
await writeFile(CONFIG.output, `${JSON.stringify(source, null, 2)}\n`);

const latest = source.apps[0].versions[0];
console.log(
  `Wrote ${CONFIG.output}: ${source.apps[0].versions.length} versions, latest ${latest.version} ` +
    `(${(latest.size / 1024 / 1024).toFixed(1)} MiB, ${latest.date})`,
);
