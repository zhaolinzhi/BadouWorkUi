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
 * 只想起主应用(调试 qiankun 之外的东西)用 `bun run dev`。
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

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
 * 扫描 packages/microapps,返回所有「有 dev script」的子应用目录名。
 *
 * 判据用「有没有 dev script」而不是硬编码名字列表:新增子应用时只要
 * package.json 里写了 dev,这里就自动带上。
 */
function discoverMicroApps() {
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
        return typeof pkg.scripts?.dev === 'string';
      } catch {
        // manifest 坏了不该让整个 dev 起不来,跳过即可
        return false;
      }
    })
    .sort();
}

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
  const microApps = discoverMicroApps();
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
