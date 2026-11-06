#!/usr/bin/env node
/**
 * Quickly regenerate out/latest*.yml from artifacts that already exist in out/.
 *
 * This is a local-only shortcut: it recomputes sha512/size and embeds
 * release-notes.md without invoking electron-builder, so iterating on update
 * metadata takes seconds instead of a full package. CI still uses the real
 * electron-builder output.
 *
 * By default it writes metadata for all six platform/arch combinations. When
 * an installer is missing from out/, the manifest is still generated with the
 * expected filename but without sha512/size, so a platform can be filled in
 * later without regenerating everything.
 *
 * Usage:
 *   node scripts/generate-local-update-manifest.js
 *   node scripts/generate-local-update-manifest.js --platform=mac
 *   node scripts/generate-local-update-manifest.js --platform=mac --arch=arm64
 */

'use strict';

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'out');

const ALL_TARGETS = [
  { platform: 'mac', arch: 'x64', channel: 'latest-mac.yml', extensions: ['.zip', '.dmg'] },
  { platform: 'mac', arch: 'arm64', channel: 'latest-arm64-mac.yml', extensions: ['.zip', '.dmg'] },
  { platform: 'win', arch: 'x64', channel: 'latest.yml', extensions: ['.exe'] },
  { platform: 'win', arch: 'arm64', channel: 'latest-win-arm64.yml', extensions: ['.exe'] },
  { platform: 'linux', arch: 'x64', channel: 'latest-linux.yml', extensions: ['.deb'] },
  { platform: 'linux', arch: 'arm64', channel: 'latest-linux-arm64.yml', extensions: ['.deb'] },
];

const readArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
};

const normalizePlatform = (value) => {
  if (value === 'darwin') return 'mac';
  if (value === 'win32') return 'win';
  return value;
};

const platformFilter = readArg('platform', '');
const archFilter = readArg('arch', '');

const targets = ALL_TARGETS.filter(
  (target) =>
    (!platformFilter || target.platform === normalizePlatform(platformFilter)) &&
    (!archFilter || target.arch === archFilter)
);

if (targets.length === 0) {
  console.error(`[manifest] No matching targets for --platform=${platformFilter} --arch=${archFilter}`);
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) {
  console.error(`[manifest] ${path.relative(ROOT_DIR, OUT_DIR)} does not exist; run a build first.`);
  process.exit(1);
}

const builderConfig = yaml.load(fs.readFileSync(path.join(ROOT_DIR, 'packages/desktop/electron-builder.yml'), 'utf8'));
const productName = builderConfig.productName || 'BadouWork';
const version = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')).version;

const notesPath = path.join(ROOT_DIR, 'release-notes.md');
if (!fs.existsSync(notesPath)) {
  execSync(`node "${path.join(__dirname, 'generate-release-notes.js')}"`, { stdio: 'inherit' });
}
const releaseNotes = fs.existsSync(notesPath) ? fs.readFileSync(notesPath, 'utf8').trimEnd() : undefined;

const sha512 = (filePath) => crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('base64');

const buildManifest = (target) => {
  const files = target.extensions.map((extension) => {
    const url = `${productName}-${version}-${target.platform}-${target.arch}${extension}`;
    const filePath = path.join(OUT_DIR, url);
    if (!fs.existsSync(filePath)) {
      // Keep the expected filename so the manifest stays valid; the download
      // will simply fail until that installer is uploaded.
      return { url };
    }
    return { url, sha512: sha512(filePath), size: fs.statSync(filePath).size };
  });

  const primary = files.find((file) => typeof file.sha512 === 'string');
  return {
    version,
    files,
    ...(primary ? { path: primary.url, sha512: primary.sha512 } : {}),
    ...(releaseNotes ? { releaseNotes } : {}),
    releaseDate: new Date().toISOString(),
  };
};

const written = [];
for (const target of targets) {
  const manifest = buildManifest(target);
  const outputPath = path.join(OUT_DIR, target.channel);
  fs.writeFileSync(outputPath, yaml.dump(manifest, { lineWidth: -1, noRefs: true }), 'utf8');
  const missing = manifest.files.filter((file) => typeof file.sha512 !== 'string').length;
  written.push({ channel: target.channel, missing });
}

console.log('[manifest] Generated:');
for (const entry of written) {
  const suffix = entry.missing > 0 ? ` (${entry.missing} missing artifact${entry.missing === 1 ? '' : 's'})` : '';
  console.log(`  - out/${entry.channel}${suffix}`);
}
