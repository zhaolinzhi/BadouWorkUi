/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 定制图标注册表 —— **自动生成,不要手改**。
 *
 * 源目录:`svg/`(文件名 = 语义名)
 * 生成者:`aionuiSvgIconPlugin` —— dev server / 构建启动时重写。
 *
 * 要新增图标:把 SVG 丢进 `svg/` 目录就行,不用改这个文件。
 */

import AccountAppearanceIcon from './svg/account-appearance.svg?component';
import AccountDarkIcon from './svg/account-dark.svg?component';
import AccountLightIcon from './svg/account-light.svg?component';
import AccountLogoutIcon from './svg/account-logout.svg?component';
import NavAppMarketIcon from './svg/nav-app-market.svg?component';
import NavKnowledgeIcon from './svg/nav-knowledge.svg?component';
import NavNoteIcon from './svg/nav-note.svg?component';
import NavRecordingIcon from './svg/nav-recording.svg?component';
import NavTaskIcon from './svg/nav-task.svg?component';
import NavWorkbenchIcon from './svg/nav-workbench.svg?component';
import NewChatIcon from './svg/new-chat.svg?component';
import SiderChevronRightIcon from './svg/sider-chevron-right.svg?component';
import SiderSettingsIcon from './svg/sider-settings.svg?component';

export const CUSTOM_ICON_MAP = {
  'account-appearance': AccountAppearanceIcon,
  'account-dark': AccountDarkIcon,
  'account-light': AccountLightIcon,
  'account-logout': AccountLogoutIcon,
  'nav-app-market': NavAppMarketIcon,
  'nav-knowledge': NavKnowledgeIcon,
  'nav-note': NavNoteIcon,
  'nav-recording': NavRecordingIcon,
  'nav-task': NavTaskIcon,
  'nav-workbench': NavWorkbenchIcon,
  'new-chat': NewChatIcon,
  'sider-chevron-right': SiderChevronRightIcon,
  'sider-settings': SiderSettingsIcon,
} as const;
