/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 图标总览 —— 开发者页面(`/test/icons`)。
 *
 * 列出 `ICON_MAP` 里登记的**全部**图标(icon-park 自带 + 定制图标),
 * 点一下就把它的语义名复制到剪贴板,直接写进 `<AppIcon name='...' />`。
 *
 * 为什么值得有一个页面
 * ====================
 * - 语义名散落在几千处调用里 —— 想确认「这个图标叫什么」只能全局搜;
 * - 新加图标时没法一眼看到「已经有哪些了、会不会撞名」;
 * - 定制图标是构建期自动登记的,不看这张表根本不知道哪些是定制来的。
 *
 * 这里的图标就是产品里真实在用的那批 —— 数据源是共享层的 `ICON_MAP`,
 * 页面不维护第二份清单,加了图标自动就多一张卡片。
 */
import { Button, Input, Message, Tag } from '@arco-design/web-react';
import React, { useMemo, useState } from 'react';

import { AppIcon, CUSTOM_ICON_MAP, ICON_MAP, type AppIconName } from '@aionui/ui';

import { copyText } from '@renderer/utils/ui/clipboard';

/** 已登记的全部图标语义名 —— `ICON_MAP` 的键就是全部可用图标。 */
const ALL_ICON_NAMES = Object.keys(ICON_MAP) as AppIconName[];

/** 这个图标是不是定制图标(设计单独给的 SVG,而非 icon-park 自带)。 */
function isCustomIcon(name: AppIconName): boolean {
  return Object.prototype.hasOwnProperty.call(CUSTOM_ICON_MAP, name);
}

const IconGalleryPage: React.FC = () => {
  const [message, contextHolder] = Message.useMessage();
  const [keyword, setKeyword] = useState('');

  const visibleNames = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return ALL_ICON_NAMES;
    return ALL_ICON_NAMES.filter((name) => name.toLowerCase().includes(trimmed));
  }, [keyword]);

  const handleCopy = async (name: AppIconName) => {
    try {
      await copyText(name);
      message.success(`已复制 ${name}`);
    } catch {
      message.error(`复制 ${name} 失败`);
    }
  };

  return (
    <div className='flex h-full flex-col'>
      {contextHolder}

      <header className='flex flex-shrink-0 items-center justify-between gap-4 border-b border-[color:var(--border-base)] bg-2 px-4 py-3'>
        <div className='min-w-0'>
          <h1 className='m-0 text-xl font-semibold'>图标总览</h1>
          <p className='m-0 mt-1 text-xs text-t-secondary'>
            共 {ALL_ICON_NAMES.length} 个图标 · 点击图标复制它的语义名,写进{' '}
            <code className='font-mono'>&lt;AppIcon name='...' /&gt;</code>
          </p>
        </div>
        <Input.Search
          allowClear
          value={keyword}
          onChange={setKeyword}
          placeholder='搜索图标名'
          style={{ width: 240 }}
        />
      </header>

      <main className='min-h-0 flex-1 overflow-auto px-4 py-4'>
        {visibleNames.length === 0 ? (
          <div className='flex h-full items-center justify-center text-t-secondary'>没有匹配「{keyword}」的图标</div>
        ) : (
          <div className='grid gap-3' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))' }}>
            {visibleNames.map((name) => (
              <Button
                key={name}
                type='default'
                long
                onClick={() => void handleCopy(name)}
                style={{ height: 'auto', padding: '14px 8px' }}
              >
                <span className='flex flex-col items-center gap-2'>
                  <AppIcon name={name} size={24} />
                  <span className='font-mono text-xs text-t-primary'>{name}</span>
                  {isCustomIcon(name) ? <Tag size='small'>定制</Tag> : null}
                </span>
              </Button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default IconGalleryPage;
