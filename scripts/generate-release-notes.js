#!/usr/bin/env node
/**
 * Generate release-notes.md from git history.
 *
 * The output is consumed by electron-builder via releaseInfo.releaseNotesFile
 * and embedded into latest*.yml, so the renderer can show update notes without
 * a separate release-notes service.
 *
 * Usage:
 *   node scripts/generate-release-notes.js [outputPath]
 *
 * The range starts at the previous version tag (vX.Y.Z^) when possible, so a
 * tag build only lists commits since the last release. When no tag is
 * available (fresh repo / shallow history) it falls back to a bounded log.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(ROOT_DIR, 'release-notes.md');
const MAX_FALLBACK_COMMITS = 30;
/** Internal-only commit types are omitted from user-facing release notes. */
const INTERNAL_COMMIT_PATTERN = /^(chore|test|ci|build|style|docs)(\(|:)/i;

const readVersion = () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  return typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';
};

const git = (args) =>
  execSync(`git ${args}`, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    // Keep git's stderr quiet: a missing tag / shallow history is expected and
    // handled by the fallbacks below.
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

const tagExists = (tag) => {
  try {
    git(`rev-parse -q --verify refs/tags/${tag}`);
    return true;
  } catch {
    return false;
  }
};

const resolvePreviousTag = (version) => {
  const currentTag = `v${version}`;
  const ref = tagExists(currentTag) ? `${currentTag}^` : 'HEAD';
  try {
    return git(`describe --tags --abbrev=0 --match "v*" ${ref}`);
  } catch {
    return '';
  }
};

const collectCommits = (previousTag) => {
  const range = previousTag ? `${previousTag}..HEAD` : `-${MAX_FALLBACK_COMMITS} HEAD`;
  try {
    const output = git(`log ${range} --no-merges --pretty=format:%s`);
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !INTERNAL_COMMIT_PATTERN.test(line))
      .filter((line, index, lines) => lines.indexOf(line) === index);
  } catch {
    return [];
  }
};

const renderMarkdown = (_version, commits) => {
  // Keep the embedded notes as a plain bullet list: the update card already
  // shows the version range and the modal is titled "更新日志", so markdown
  // headings would only add oversized bold text.
  const lines = [];
  if (commits.length === 0) {
    lines.push('- 常规维护与优化');
  } else {
    for (const commit of commits) {
      lines.push(`- ${commit}`);
    }
  }
  lines.push('');
  return lines.join('\n');
};

const main = () => {
  const outputPath = path.resolve(ROOT_DIR, process.argv[2] || DEFAULT_OUTPUT);
  const version = readVersion();
  const previousTag = resolvePreviousTag(version);
  const commits = collectCommits(previousTag);
  fs.writeFileSync(outputPath, renderMarkdown(version, commits), 'utf8');
  console.log(
    `[release-notes] Generated ${path.relative(ROOT_DIR, outputPath)} for v${version} ` +
      `(${commits.length} commit${commits.length === 1 ? '' : 's'}, previous tag: ${previousTag || 'none'})`
  );
};

main();
