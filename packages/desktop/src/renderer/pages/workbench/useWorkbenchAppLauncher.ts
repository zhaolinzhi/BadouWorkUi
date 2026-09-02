/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useState } from 'react';
import { Message } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { isElectronDesktop, openExternalUrl } from '@renderer/utils/platform';
import type { WorkbenchApp } from './apps';

export interface UseWorkbenchAppLauncher {
  /**
   * URL currently loaded in the in-page webview. `null` while the card grid
   * is shown. Set by `launch` on Electron; untouched on WebUI.
   */
  activeUrl: string | null;
  /**
   * Open the given workbench app.
   * - Returns early with a warning if the user has no token.
   * - On Electron: loads `activeUrl` in the in-page `<WebviewHost>` (the
   *   workbench page renders the webview itself; the Preview panel is only
   *   available inside project conversations).
   * - On WebUI: falls back to `openExternalUrl` (no webview available).
   * - Any thrown error is surfaced via `Message.error` and logged.
   */
  launch: (app: WorkbenchApp) => Promise<void>;
  /** Return to the card grid (clears `activeUrl`). */
  close: () => void;
  /**
   * Update the URL shown in the webview. Used by the page's
   * `<WebviewHost onUrlChange>` so internal navigation stays in sync.
   */
  setActiveUrl: (url: string) => void;
}

/**
 * Launch workbench apps inside the workbench page's own in-app webview.
 *
 * NOTE: we intentionally do NOT route through `PreviewContext.openBrowserTab`
 * here — the Preview panel only renders while a project conversation is
 * active (`Layout.tsx` gates it on `currentProject`), so on the non-chat
 * `/workbench` route the panel never mounts and opened tabs would be
 * invisible. Instead the hook tracks `activeUrl` and the page renders
 * `<WebviewHost>` directly.
 */
export const useWorkbenchAppLauncher = (): UseWorkbenchAppLauncher => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

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
          setActiveUrl(finalUrl);
        } else {
          await openExternalUrl(finalUrl);
        }
      } catch (error) {
        console.error('Failed to open workbench app:', error);
        Message.error(t('workbench.openFailed', { defaultValue: '打开应用失败' }));
      }
    },
    [user?.token, t]
  );

  const close = useCallback(() => {
    setActiveUrl(null);
  }, []);

  return { activeUrl, launch, close, setActiveUrl };
};
