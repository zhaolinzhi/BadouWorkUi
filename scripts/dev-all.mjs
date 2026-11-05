#!/usr/bin/env node
/**
 * `bun run dev:all` 的编排入口:一条命令拉起主应用 + 全部子应用 dev server。
 *
 * 之前每个子应用都要自己开一个终端(`docs/qiankun/01-quickstart.md` §3.1),
 * 加一个子应用就多一个终端。这个脚本改成:
 *
 *   - 主应用 → `bun run dev`(即 electron-vite dev)
 *   - 子应用 → `packages/microapps/*` 里凡是有 `dev` script 的目录,
 *             逐个 `bun run dev`。`shared` 是纯库(没有 dev),自动跳过;
 *             以后新增子应用不用改这里。
 *
 * 每路输出加彩色前缀,Ctrl-C 一次全停;任何一路非零退出会把其它几路一起收掉,
 * 避免留下孤儿 vite 进程占着 7991/7992/7993。
 *
 * 启动前有两道预检:后端整包在不在(缺了后端起不来)、子应用端口空不空
 * (被占的话 vite 会先成功起两个再报一个)。
 *
 * 只想起主应用(调试 qiankun 之外的东西)用 `bun run dev`。
 *
 * 子应用发现逻辑与构建态(`scripts/build-micro-apps.mjs`,即 `bun run build:all`)共用
 * 同一个 discoverMicroApps —— 两份判据迟早会漂,新增子应用时只改一处。
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { discoverMicroApps } from './build-micro-apps.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MICROAPPS_DIR = path.join(ROOT, 'packages', 'microapps');
const isWindows = process.platform === 'win32';

const COLOR = {
  reset: '[0m',
  dim: '[90m',
  green: '[32m',
  yellow: '[33m',
  blue: '[34m',
  cyan: '[36m',
};

// TTY 才上色,重定向到文件时不污染日志
const useColor = process.stdout.isTTY;
const paint = (color, text) => (useColor ? `${color}${text}${COLOR.reset}` : text);

/**
 * 从子应用的 vite.config.* 里读出 dev server 端口。
 *
 * 解析不了就返回 null(跳过检查)而不是报错 —— 这只是一层提前提示,
 * 真正的冲突判定交给 vite 自己的 strictPort。
 */
function readDevServerPort(name) {
  const dir = path.join(MICROAPPS_DIR, name);
  const configFile = ['vite.config.ts', 'vite.config.mts', 'vite.config.js']
    .map((file) => path.join(dir, file))
    .find((file) => fs.existsSync(file));
  if (!configFile) return null;
  try {
    const match = fs.readFileSync(configFile, 'utf8').match(/^\s*port:\s*(\d+)\s*,?\s*$/m);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

/** 端口被谁占着。取不到就返回空数组(检查降级,不阻断 dev)。 */
function pidsOnPort(port) {
  try {
    const output = isWindows
      ? run(`netstat -ano -p tcp | findstr :${port}`)
      : run(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t || true`);
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^\d+$/.test(line));
  } catch {
    return [];
  }
}

/**
 * 跑一条 shell 命令并拿回 stdout。
 *
 * 用 spawnSync 而不是 execFileSync:后者带 `shell: true` 时会稳定抛 ENOBUFS
 * (同步模式下 /bin/sh 的输出管道没人读),端口预检会因此静默失效 —— 明明
 * 端口被占着却报告「一切正常」,比不检查更糟。
 */
function run(command) {
  const result = spawnSync(command, { shell: true, encoding: 'utf8' });
  if (result.error || typeof result.stdout !== 'string') {
    throw result.error ?? new Error(`命令执行失败: ${command}`);
  }
  return result.stdout.trim();
}

/** PATH 上有没有这个可执行文件。取不到就返回空字符串(检查降级,不阻断 dev)。 */
function findOnPath(binaryName) {
  try {
    const output = run(isWindows ? `where ${binaryName}` : `which ${binaryName}`);
    const first = output.split(/\r?\n/).find((line) => line.trim());
    return first ? first.trim() : '';
  } catch {
    return '';
  }
}

/**
 * 后端整包预检:随仓库的后端不在,就别指望后端能起来。
 *
 * `resources/bundled-aioncore/` 是 gitignore 的构建缓存,`git clean -xfd`、构建
 * 中断、手误删都会把它清空。清空之后后端解析(binaryResolver)会退到 PATH 上的
 * `aioncore` —— 那多半是**另一个仓库谱系**的二进制(本仓库 pin 的是
 * zhaolinzhi/BadouWorkCore,PATH 上常见的是上游 iOfficeAI/AionCore)。两个谱系的
 * sqlx migration 编号对不上,对着同一个数据目录跑会报 checksum 冲突,应用界面上
 * 只显示成「本地数据迁移失败」,完全看不出是二进制拿错了。
 *
 * 所以在拉起任何进程之前先查一遍,把话说清楚,别让人对着弹窗猜。
 */
function assertBackendBundleReady() {
  const runtimeKey = `${process.platform}-${process.arch}`;
  const bundleDir = path.join(ROOT, 'resources', 'bundled-aioncore', runtimeKey);
  const binaryName = process.platform === 'win32' ? 'aioncore.exe' : 'aioncore';
  const binaryPath = path.join(bundleDir, binaryName);
  if (fs.existsSync(binaryPath)) return;

  const relative = path.relative(ROOT, binaryPath);
  const onPath = findOnPath(binaryName);

  if (!onPath) {
    // PATH 上也没有 → 后端无论如何都起不来,直接拦在启动前
    process.stderr.write(`${paint(COLOR.yellow, `[dev] 找不到后端二进制 ${relative}`)}\n\n`);
    process.stderr.write(`  先把后端整包准备好:\n`);
    process.stderr.write(`    ${paint(COLOR.yellow, 'node scripts/prepareAioncore.js')}\n\n`);
    process.exit(1);
  }

  // PATH 上有 —— 可能对,也可能来自另一个谱系。先警告,不停,让用户自己判断。
  process.stderr.write(
    `${paint(COLOR.yellow, `[dev] 没找到随仓库的后端整包(${relative}),将改用 PATH 上的 ${onPath}`)}\n`
  );
  process.stderr.write(
    `  ${paint(COLOR.dim, '若它与本仓库不是同一谱系,启动会报 migration checksum 冲突(界面上显示为「本地数据迁移失败」)。')}\n`
  );
  process.stderr.write(`  ${paint(COLOR.dim, '恢复随仓库的整包: node scripts/prepareAioncore.js')}\n\n`);
}

/**
 * 端口预检:在拉起任何进程之前先说清楚,免得启动到一半才炸。
 *
 * 这条对「以前手动开过子应用、现在改用 bun run dev:all」的人尤其重要 —— 他机器上
 * 7991/7992/7993 还占着,不预检的话 vite 会先成功起两个再报一个。
 */
function assertPortsFree(microApps) {
  const conflicts = [];
  for (const name of microApps) {
    const port = readDevServerPort(name);
    if (port === null) continue;
    const pids = pidsOnPort(port);
    if (pids.length > 0) conflicts.push({ name, port, pids });
  }
  if (conflicts.length === 0) return;

  for (const { name, port, pids } of conflicts) {
    process.stderr.write(
      `${paint(COLOR.yellow, `[dev] 端口 ${port} 已被占用(${pids.join(', ')}),子应用 ${name} 起不来`)}\n`
    );
  }
  process.stderr.write(`\n  这些多半是你之前手动起的子应用。先停掉:\n`);
  for (const { port } of conflicts) {
    process.stderr.write(`    ${paint(COLOR.yellow, `kill $(lsof -ti tcp:${port})`)}\n`);
  }
  process.stderr.write(`\n  只想起主应用、不需要子应用:\n    ${paint(COLOR.yellow, 'bun run dev')}\n\n`);
  process.exit(1);
}

/** 把子进程输出按行拆出来,逐行加前缀;半行(没有换行结尾)先缓存不吐。 */
function pipeWithPrefix(stream, target, prefix) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) target.write(`${prefix} ${line}\n`);
  });
  stream.on('end', () => {
    if (buffer.length > 0) target.write(`${prefix} ${buffer}\n`);
  });
}

const children = [];
let shuttingDown = false;

function stopAll(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    // bun run dev 自己还会再 fork 一个 vite,只 kill bun 会留下孤儿 vite 占端口。
    // POSIX 用进程组、Windows 用 taskkill /T 把整棵子树收掉。
    if (isWindows) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      spawn('pkill', ['-TERM', '-P', String(child.pid)], { stdio: 'ignore' });
      child.kill(signal);
    }
  }
  // 给一点时间优雅退出,没退干净就 SIGKILL 兜底
  setTimeout(() => {
    for (const { child } of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  }, 2000).unref();
}

function start(label, color, cwd, args) {
  const child = spawn('bun', args, {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
  });

  // label 由 main() 统一 padEnd 到同一宽度,这里不要再补一次
  const prefix = paint(color, `[${label}]`);
  pipeWithPrefix(child.stdout, process.stdout, prefix);
  pipeWithPrefix(child.stderr, process.stderr, prefix);

  child.on('error', (error) => {
    process.stderr.write(`${prefix} 启动失败: ${error.message}\n`);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `信号 ${signal}` : `退出码 ${code}`;
    process.stderr.write(`${prefix} 已退出(${reason}),正在关闭其余进程...\n`);
    stopAll();
    // Ctrl-C(SIGINT/SIGTERM)不算失败,退出码交给上层决定
    process.exit(signal ? 130 : (code ?? 0));
  });

  children.push({ label, child });
  return child;
}

function main() {
  const microApps = discoverMicroApps('dev');
  assertBackendBundleReady();
  assertPortsFree(microApps);

  // 前缀对齐用:最长的一路决定宽度,输出看起来才是一列
  const labels = ['shell', ...microApps.map((name) => `app:${name}`)];
  const labelWidth = Math.max(...labels.map((label) => label.length));

  const startMicroApp = (name) => {
    console.log(paint(COLOR.dim, `→ ${name}  ${path.relative(ROOT, path.join(MICROAPPS_DIR, name))}`));
    start(`app:${name}`.padEnd(labelWidth), COLOR.cyan, path.join(MICROAPPS_DIR, name), ['run', 'dev']);
  };

  console.log(paint(COLOR.green, `[dev] 启动主应用 + ${microApps.length} 个子应用`));
  console.log(paint(COLOR.dim, '     Ctrl-C 一次全部停止'));

  start('shell'.padEnd(labelWidth), COLOR.blue, ROOT, ['run', 'dev']);
  microApps.forEach(startMicroApp);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopAll(signal);
    process.exit(130);
  });
}

main();
