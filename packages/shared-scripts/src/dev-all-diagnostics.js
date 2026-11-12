/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: MIT
 */

/**
 * `bun run dev:all` 的诊断文案。
 *
 * 这个脚本最坑的失败形态是「命令跑过了,但服务没起来」:
 *
 * - node 版本过低(< 22)时,子应用的 vite 直接崩 —— 它的 ESM 用了 ES2021 的 `||=`,
 *   老 node 抛 `SyntaxError: Unexpected token '||='` 之后进程立刻退出;
 * - dev-all 的策略是「任何一路非零退出会把其它几路一起收掉」,于是一路子应用崩了,
 *   三个子应用被连带关闭、端口全部释放,只剩主应用还活着;
 * - 界面上表现为微应用整片白屏,而日志里只有一行「已退出(退出码 1)」。
 *
 * 从现象完全看不出发生过什么,所以这里把「为什么」直接写进 console。
 * 文案抽成纯函数是为了能单测,也是为了保证 dev-all 里到处是同一套说法。
 */

/**
 * 子进程异常退出时的诊断文案。
 *
 * @param {{ kind: 'shell' | 'microapp', label: string, code?: number | null, signal?: string | null }} options
 * @returns {string} 多行文本
 */
function formatExitDiagnosis(options) {
  const { kind, label, code, signal } = options;
  const reason = signal ? `信号 ${signal}` : `退出码 ${code}`;
  const lines = [`[${label}] 已退出(${reason}),正在关闭其余进程...`];

  if (kind === 'microapp') {
    lines.push('  子应用退出后,dev-all 会连带关闭其余子应用与主应用,对应端口也会被释放。');
    lines.push('  最常见的原因:node 版本过低(仓库要求 >= 22)—— vite 的 ESM 会抛');
    lines.push('  "SyntaxError: Unexpected token \'||=\'" 并立刻退出,端口从来就没出现过。');
    lines.push('  先 `node -v` 确认版本(nvm use 22),再重新执行 bun run dev:all。');
  } else {
    lines.push('  主应用退出后,dev-all 会连带关闭全部子应用。');
    lines.push('  修好后重新执行 bun run dev:all。');
  }

  return lines.join('\n');
}

/**
 * 启动后复核:某个子应用的端口没人监听时的提示。
 *
 * 端口检查只在启动前做(避免端口冲突),启动后还得再查一次 —— 「命令跑过了」
 * 不等于「服务活着」:子应用可能起来几秒后就崩了,这时候端口从来就没出现过。
 *
 * @param {{ name: string, port: number }} options
 * @returns {string} 多行文本
 */
function formatMissingPortWarning(options) {
  const { name, port } = options;
  return [
    `[dev] ${name} 的 dev server 没有监听 ${port},该子应用会白屏。`,
    '  「命令跑过了」不等于「服务活着」:node 版本过低时 vite 会秒崩,端口从来没出现过。',
    `  先看这个子应用终端里的报错,再用 \`curl -s http://localhost:${port}/\` 复核。`,
  ].join('\n');
}

module.exports = { formatExitDiagnosis, formatMissingPortWarning };
