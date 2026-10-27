#!/usr/bin/env node
/**
 * 子应用产物构建 + 落位。
 *
 * `scripts/dev-all.mjs` 的构建态对应物:那边一条命令拉起全部子应用 dev server,
 * 这边一条命令把全部子应用打进 `out/renderer/microapps/<name>/`,让 `bun run build:all`
 * 产出的安装包自带微应用(离线可用)。
 *
 * 由 `scripts/build-with-builder.js` 在 electron-vite build 之后调用 —— 顺序是硬约束:
 * electron-vite build 会清空 `out/`,早一步做的话拷进去的东西会被抹掉。
 *
 * 同一份产物也支持独立部署:子应用用相对 base 构建,直接把 `dist/` 传到 CDN 即可
 * (详见 docs/qiankun/06-build-and-deploy.md)。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import nodeVersionGate from '../packages/shared-scripts/src/assert-node-version.js';

const { assertNodeVersion } = nodeVersionGate;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MICROAPPS_DIR = path.join(ROOT, 'packages', 'microapps');
/** 子应用在产物里的落位。/ Where micro apps land in the build output. */
const MICRO_APP_OUT_DIR = path.join(ROOT, 'out', 'renderer', 'microapps');

const isWindows = process.platform === 'win32';

const COLOR = {
  reset: '[0m',
  green: '[32m',
  yellow: '[33m',
  red: '[31m',
  dim: '[90m',
  cyan: '[36m',
};
const useColor = process.stdout.isTTY;
const paint = (color, text) => (useColor ? `${color}${text}${COLOR.reset}` : text);

/**
 * 扫描 packages/microapps,返回 `package.json` 里声明了指定 script 的子应用目录名。
 *
 * 判据用「有没有这个 script」而不是硬编码名字列表:新增子应用时只要在 package.json 里
 * 写了 `dev`(给 dev-all 用)或 `build`(给这里用),就会被自动带上。`shared` 两个都没有,
 * 自动跳过。
 *
 * Scan packages/microapps for directories whose package.json declares `scriptName`.
 *
 * The predicate is "does it declare this script" rather than a hardcoded name list, so a new
 * micro app joins automatically once it adds the script. `shared` declares neither and is
 * skipped.
 */
export function discoverMicroApps(scriptName) {
  if (!fs.existsSync(MICROAPPS_DIR)) return [];
  return fs
    .readdirSync(MICROAPPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const manifest = path.join(MICROAPPS_DIR, name, 'package.json');
      if (!fs.existsSync(manifest)) return false;
      try {
        const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        return typeof pkg.scripts?.[scriptName] === 'string';
      } catch {
        // manifest 坏了不该让整条构建链挂掉,跳过即可
        return false;
      }
    })
    .sort();
}

/**
 * 确认产物是 qiankun 认得的形态:必须有 index.html。
 *
 * qiankun 的 import-html-entry 只从 HTML 里解析 `<script>` / `<link>`,喂一个裸 .js URL
 * 会解析出零个 script —— 子应用表现为「加载了但什么都不渲染」,没有任何报错。
 * 所以这里宁可炸在打包期,也不要产出一个装进去打不开的安装包。
 */
function assertHtmlEntry(name) {
  const entry = path.join(MICROAPPS_DIR, name, 'dist', 'index.html');
  if (fs.existsSync(entry)) return;
  process.stderr.write(
    `${paint(COLOR.red, `[build:all] ${name} 的产物里没有 dist/index.html`)}\n` +
      `${paint(COLOR.dim, `  qiankun 的 entry 必须是 HTML,不是裸 JS。检查 ${name}/vite.config.ts`)}\n` +
      `${paint(COLOR.dim, `  里有没有把 build.lib 又加回去 —— 见 docs/qiankun/06-build-and-deploy.md`)}\n\n`
  );
  process.exit(1);
}

/**
 * 超过一个 JS chunk 就提醒:code-split 出来的 chunk 用相对路径动态 import,
 * 而 qiankun 是在 eval 上下文里跑子应用代码的,那里的相对 specifier 会按 shell 的
 * document base URL 解析(打包后是 file://),不是子应用 entry 的 URL。
 * 不是硬失败 —— 万一某个 chunk 从没被触发,还能跑。
 */
function warnOnSplitChunks(name, distDir) {
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) return;
  const chunks = fs.readdirSync(assetsDir).filter((file) => file.endsWith('.js'));
  if (chunks.length <= 1) return;
  process.stderr.write(
    `${paint(COLOR.yellow, `[build:all] ${name} 产出了 ${chunks.length} 个 JS chunk`)}\n` +
      `${paint(COLOR.dim, '  在 qiankun 下,code-split 出来的动态 import 会解析到 shell 的 base URL 而不是子应用 entry。')}\n` +
      `${paint(COLOR.dim, '  如果加载子应用时报模块找不到,先把这个应用改回单 chunk。')}\n\n`
  );
}

function buildOne(name) {
  const cwd = path.join(MICROAPPS_DIR, name);
  const entry = path.join(cwd, 'dist', 'index.html');
  // 构建前的产物时间戳。构建失败时 vite 不会清空 outDir,上一次的 dist/ 会留在原地 ——
  // 不比一下就会把陈旧产物当成新产物拷进安装包。
  // Timestamp of the pre-build artifact. A failed build leaves the previous dist/ in
  // place (vite only empties outDir on success), so without this check a stale build
  // would be copied into the installer.
  const before = fs.existsSync(entry) ? fs.statSync(entry).mtimeMs : -1;

  console.log(paint(COLOR.cyan, `[build:all] ${name}`));
  const result = spawnSync('bun', ['run', 'build'], { cwd, stdio: 'inherit', shell: isWindows });
  if (result.error || result.status !== 0) {
    throw new Error(`子应用 ${name} 构建失败(退出码 ${result.status ?? 'null'})`);
  }

  // `bun run build` 的退出码不可靠:子应用的 vite 构建失败时它仍可能返回 0 ——
  // 旧版 node 上 unocss / vite-plugin-qiankun 的 ESM 会抛 "SyntaxError: Unexpected
  // token '||='" 而 bun 不把它当失败。所以在这里就查产物,别拖到 assertHtmlEntry
  // 才报「没有 index.html」—— 那条信息跟真实原因不沾边。
  //
  // `bun run build`'s exit code is not trustworthy: a failed vite build can still exit 0
  // (old node chokes on `||=` in unocss / vite-plugin-qiankun's ESM, and bun does not
  // treat that as a failure). Check the artifact here instead of surfacing a misleading
  // "no index.html" error later.
  const after = fs.existsSync(entry) ? fs.statSync(entry).mtimeMs : -1;
  if (after <= before) {
    throw new Error(
      `子应用 ${name} 构建没有产出新的 dist/index.html(命令却返回了成功)。` +
        `常见原因是 node 版本过低 —— 当前 ${process.version},仓库要求 >=22 <25。`
    );
  }
}

function copyOne(name) {
  const dist = path.join(MICROAPPS_DIR, name, 'dist');
  assertHtmlEntry(name);
  warnOnSplitChunks(name, dist);
  const target = path.join(MICRO_APP_OUT_DIR, name);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(MICRO_APP_OUT_DIR, { recursive: true });
  fs.cpSync(dist, target, { recursive: true });
}

/** 构建全部子应用并复制到 out/renderer/microapps/<name>/。 */
export function buildAndCopyMicroApps() {
  // node 版本闸门:这个脚本用 PATH 上的 node 跑(旧版 node 缺 fs.cpSync,
  // 且子应用的 vite 构建会因 `||=` 语法错而静默失败)。
  assertNodeVersion();

  const microApps = discoverMicroApps('build');
  if (microApps.length === 0) {
    process.stderr.write(`${paint(COLOR.red, '[build:all] packages/microapps 下没有任何带 build script 的子应用')}\n`);
    process.exit(1);
  }
  for (const name of microApps) buildOne(name);
  // 整体重建而不是增量合并:上一次留下的 chunk 名不该混进这次的安装包。
  for (const name of microApps) copyOne(name);
  console.log(paint(COLOR.green, `[build:all] ${microApps.length} 个子应用已复制到 out/renderer/microapps/`));
  console.log(paint(COLOR.dim, '  entry: app://microapps/<name>/index.html(VITE_MICRO_APP_ASSET_BASE)'));
}

// 只有被直接执行时才跑构建 —— dev-all.mjs 要 import 这里的 discoverMicroApps,
// 顺带执行一次全量构建会把它自己绊倒。
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    buildAndCopyMicroApps();
  } catch (error) {
    process.stderr.write(
      `${paint(COLOR.red, `[build:all] ${error instanceof Error ? error.message : String(error)}`)}\n`
    );
    process.exit(1);
  }
}
