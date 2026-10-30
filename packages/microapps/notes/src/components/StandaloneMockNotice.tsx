/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 独立运行(dev + 无宿主)时的「演示数据」提示条。
 *
 * 为什么需要它
 * =============
 * 独立运行时 notes 没有 Electron 宿主,也就没有真 bridge,页面上的笔记本 / 笔记
 * 全是 `__qiankun__/standaloneMock.ts` 里的内存种子数据(Inbox / Work 两本 +
 * 三条假笔记)。这份假数据和真数据在界面上**长得一模一样**,于是:
 *
 *   - 独立打开看到 Inbox / Work,嵌到主应用里却是空的 —— 看着像"数据丢了";
 *   - 在独立模式下新建的笔记本,刷新就没了 —— 像是"保存失败"。
 *
 * 所以在假数据生效时把这件事明说出来。被 shell 托管时这个组件返回 null,
 * 主应用里的布局完全不受影响。
 */
import { Tips } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { isStandaloneMockActive } from '../__qiankun__/standaloneMock';
import styles from './StandaloneMockNotice.module.css';

const StandaloneMockNotice: React.FC = () => {
  const { t } = useTranslation();

  // 假 bridge 只在独立运行时装上;被托管时这里是 false,组件不渲染任何东西。
  if (!isStandaloneMockActive()) return null;

  return (
    <div className={styles.notice} role='status'>
      <Tips size={14} theme='outline' fill='currentColor' />
      <span>
        {t('settings.notesStandaloneMockNotice', {
          defaultValue:
            'Standalone mode: this is built-in demo data. It resets on reload and never reaches your real notebooks.',
        })}
      </span>
    </div>
  );
};

export default StandaloneMockNotice;
