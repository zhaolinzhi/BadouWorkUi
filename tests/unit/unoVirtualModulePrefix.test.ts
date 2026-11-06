/**
 * UnoCSS 虚拟模块前缀必须**每个应用都不一样**。
 *
 * qiankun 的微应用与 shell 共用同一个 document,Vite 客户端又会把 DOM 里已有的
 * `<style data-vite-dev-id>` 标签反向认领进自己的 map —— 两个应用都用默认前缀
 * `__uno` 时,后加载的应用会原地覆盖前一个应用的 UnoCSS 产物,对方的工具类全部
 * 失效(左侧栏塌成竖排图标,即「点击笔记后样式全乱」)。
 *
 * 完整原理见 `packages/desktop/src/renderer/styles/uno-tokens.ts` 顶部注释。
 */
import { describe, expect, it } from 'vitest';
import shellConfig from '../../uno.config';
import knowledgeBaseConfig from '../../packages/microapps/knowledge-base/uno.config';
import meetingRecordingConfig from '../../packages/microapps/meeting-recording/uno.config';
import notesConfig from '../../packages/microapps/notes/uno.config';

type UnoConfig = { virtualModulePrefix?: string };

const apps: Array<{ name: string; config: UnoConfig }> = [
  { name: 'shell', config: shellConfig as UnoConfig },
  { name: 'notes', config: notesConfig as UnoConfig },
  { name: 'knowledge-base', config: knowledgeBaseConfig as UnoConfig },
  { name: 'meeting-recording', config: meetingRecordingConfig as UnoConfig },
];

describe('UnoCSS 虚拟模块前缀', () => {
  it('每个应用都显式声明了 virtualModulePrefix', () => {
    for (const app of apps) {
      expect(app.config.virtualModulePrefix, `${app.name} 未声明 virtualModulePrefix`).toBeTruthy();
    }
  });

  it('四个应用的前缀互不相同', () => {
    const prefixes = apps.map((app) => app.config.virtualModulePrefix);
    expect(new Set(prefixes).size).toBe(apps.length);
  });

  it('没有沿用 UnoCSS 的默认前缀 __uno', () => {
    // 默认前缀一旦被谁漏改回去,两个应用的虚拟模块 id 就会撞成同一个 /__uno.css
    for (const app of apps) {
      expect(app.config.virtualModulePrefix).not.toBe('__uno');
    }
  });

  it('前缀只含字母数字和下划线(UnoCSS 会把它拼进正则)', () => {
    // UnoCSS 用 `new RegExp("[/\\\\]" + prefix + ...)` 解析虚拟模块 id,
    // 前缀里出现正则元字符会让解析规则失配。
    for (const app of apps) {
      expect(app.config.virtualModulePrefix, `${app.name} 的前缀含非法字符`).toMatch(/^[A-Za-z0-9_]+$/);
    }
  });
});
