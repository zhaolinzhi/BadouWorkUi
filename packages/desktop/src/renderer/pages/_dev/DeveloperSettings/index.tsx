/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingsPageHeader from '@renderer/pages/settings/components/SettingsPageHeader';
import SettingsPageWrapper from '@renderer/pages/settings/components/SettingsPageWrapper';
import DevSettings from './DevSettings';

/**
 * 开发者设置页(`/settings/developer`)。
 *
 * 只在开发构建里存在 —— import.meta.env.DEV 是构建期常量:renderer 打包时
 * mode=production,这个页面在正式版里既不在设置导航里,直接敲路由也只会渲染空白。
 */
const DeveloperSettings: React.FC = () => {
  const { t } = useTranslation();

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <SettingsPageWrapper>
      <div className='flex flex-col gap-16px'>
        <SettingsPageHeader title={t('settings.developerSettings')} description={t('settings.developerSettingsDesc')} />
        <DevSettings />
      </div>
    </SettingsPageWrapper>
  );
};

export default DeveloperSettings;
