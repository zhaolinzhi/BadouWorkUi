/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { Message } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { usePreviewContext } from '@renderer/pages/conversation/Preview/context/PreviewContext';
import { isElectronDesktop, openExternalUrl } from '@renderer/utils/platform';
import type { WorkbenchApp } from './apps';

export interface UseWorkbenchAppLauncher {
  /**
   * Open the given workbench app inside the in-app Browser tab.
   * - Returns early with a warning if the user has no token.
   * - On Electron: routes through `openBrowserTab` so the existing Browser
   *   tab system handles persistence, session cookies, and tab UI.
   * - On WebUI: falls back to `openExternalUrl` (no webview available).
   * - Any thrown error is surfaced via `Message.error` and logged.
   */
  launch: (app: WorkbenchApp) => Promise<void>;
}

export const useWorkbenchAppLauncher = (): UseWorkbenchAppLauncher => {
  const { user } = useAuth();
  const { openBrowserTab } = usePreviewContext();
  const { t } = useTranslation();

  const launch = useCallback(
    async (app: WorkbenchApp): Promise<void> => {
      if (!user?.token) {
        Message.warning(t('workbench.noToken', { defaultValue: '请先登录后再打开工作台' }));
        return;
      }
      try {
        const url = new URL(app.url);
        for (const [key, value] of Object.entries(app.extraParams ?? {})) {
          url.searchParams.set(key, value);
        }
        url.searchParams.set('Token', user.token);
        const finalUrl = url.toString();
        if (isElectronDesktop()) {
          openBrowserTab(finalUrl);
        } else {
          await openExternalUrl(finalUrl);
        }
      } catch (error) {
        console.error('Failed to open workbench app:', error);
        Message.error(t('workbench.openFailed', { defaultValue: '打开应用失败' }));
      }
    },
    [user?.token, openBrowserTab, t]
  );

  return { launch };
};
