/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 守卫:`ICON_MAP` 与文档的「图标语义名全表」必须一致。
 *
 * 那张表是**手工维护**的 —— 加了图标忘了更新文档,读者就会照着过期的表去用,
 * 排查起来很费时间。这里双向校验:代码里的键必须出现在文档里,文档里的名字也
 * 必须真的存在于映射表(防删了图标忘了删文档行)。
 *
 * 文档:`docs/contributing/ui-components/app-icon.md`
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ICON_MAP } from '../icons';

const DOC_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../docs/contributing/ui-components/app-icon.md'
);

const SECTION_TITLE = '## 图标语义名全表';

/** 取出「图标语义名全表」小节里表格第一列的语义名。 */
function readDocumentedNames(): Set<string> {
  const markdown = readFileSync(DOC_PATH, 'utf-8');
  const titleIndex = markdown.indexOf(SECTION_TITLE);
  if (titleIndex === -1) {
    throw new Error(`文档里找不到「${SECTION_TITLE}」小节:${DOC_PATH}`);
  }
  const body = markdown.slice(titleIndex + SECTION_TITLE.length);
  const nextHeading = body.search(/\n##\s/);
  const section = nextHeading === -1 ? body : body.slice(0, nextHeading);

  const names = new Set<string>();
  for (const line of section.split('\n')) {
    // 表格行:`| `arrow-left` | `ArrowLeft` | 备注 |` —— 第一列可能是语义名,
    // 也可能带反引号。表头(中文)与分隔行(横线)都匹配不上。
    const match = /^\|\s*`?([a-z][a-z0-9-]*)`?\s*\|/.exec(line);
    if (match?.[1]) names.add(match[1]);
  }
  return names;
}

describe('ICON_MAP 与文档的语义名全表', () => {
  it('映射表里的每个图标都在文档表格里', () => {
    const documented = readDocumentedNames();
    const missing = Object.keys(ICON_MAP).filter((name) => !documented.has(name));
    expect(missing, `新增图标后请把 ${missing.join('、')} 补进 app-icon.md 的「图标语义名全表」`).toEqual([]);
  });

  it('文档表格里没有已下线的图标', () => {
    const documented = readDocumentedNames();
    const stale = [...documented].filter((name) => !(name in ICON_MAP));
    expect(stale, `文档里的 ${stale.join('、')} 已不在 ICON_MAP 里，请删掉对应的表格行`).toEqual([]);
  });

  it('映射表不是空的', () => {
    expect(Object.keys(ICON_MAP).length).toBeGreaterThan(0);
  });
});
