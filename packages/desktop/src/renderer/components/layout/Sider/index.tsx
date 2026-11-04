import classNames from 'classnames';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Message } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePreviewContext } from '@renderer/pages/conversation/Preview/context/PreviewContext';
import { cleanupSiderTooltips, getSiderTooltipProps } from '@renderer/utils/ui/siderTooltip';
import { PerfProfiler, mark } from '@renderer/utils/perf';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { blurActiveElement } from '@renderer/utils/ui/focus';
import { useThemeContext } from '@renderer/hooks/context/ThemeContext';
import {
  SiderToolbar,
  SiderSearchEntry,
  SiderScheduledEntry,
  SiderAssistantEntry,
  SiderKnowledgeEntry,
  SiderNoteEntry,
  SiderMeetingRecordingEntry,
  SiderWorkbenchEntry,
  SiderTaskCenterEntry,
  SiderAppMarketEntry,
} from './SiderNav';
import SiderFooter from './SiderFooter';
import TeamSiderSection from './TeamSiderSection';
import siderStyles from './Sider.module.css';

const WorkspaceGroupedHistory = React.lazy(() => import('@renderer/pages/conversation/GroupedHistory'));
const SettingsSider = React.lazy(() => import('@renderer/pages/settings/components/SettingsSider'));

interface SiderProps {
  onSessionClick?: () => void;
  collapsed?: boolean;
}

const Sider: React.FC<SiderProps> = ({ onSessionClick, collapsed = false }) => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const location = useLocation();
  const { pathname, search, hash } = location;

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { closePreview, clearPreviewForScope, isOpen: previewIsOpen } = usePreviewContext();
  const { logout, status, user } = useAuth();
  const { theme, setTheme } = useThemeContext();
  const [isBatchMode, setIsBatchMode] = useState(false);
  const isSettings = pathname.startsWith('/settings');
  const lastNonSettingsPathRef = useRef('/guid');
  const showLogout = true;
  //   typeof window !== 'undefined' && !(window as { electronAPI?: unknown }).electronAPI && status === 'authenticated';

  useEffect(() => {
    if (!pathname.startsWith('/settings')) {
      lastNonSettingsPathRef.current = `${pathname}${search}${hash}`;
    }
  }, [pathname, search, hash]);

  const handleNewChat = () => {
    mark('perf.nav.click', 'nav_click', { target: '/guid', previewOpen: previewIsOpen });
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/guid', { state: { resetAssistant: true } })).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleSettingsClick = () => {
    mark('perf.settings.click', 'settings_click', {
      isSettings,
      target: isSettings ? lastNonSettingsPathRef.current || '/guid' : '/settings/agent',
    });
    cleanupSiderTooltips();
    blurActiveElement();
    if (isSettings) {
      const target = lastNonSettingsPathRef.current || '/guid';
      Promise.resolve(navigate(target)).catch((error) => {
        console.error('Navigation failed:', error);
      });
    } else {
      Promise.resolve(navigate('/settings/agent')).catch((error) => {
        console.error('Navigation failed:', error);
      });
    }
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleConversationSelect = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    // Do NOT call closePreview() here. conversation/index.tsx calls
    // closePreviewIfScopeChanged() once the conversation data loads, which
    // keeps the preview open when switching between conversations of the same
    // scope and closes it only when the scope (today = workspace) actually changes.
    setIsBatchMode(false);
  };

  const handleScheduledClick = () => {
    mark('perf.nav.click', 'nav_click', { target: '/scheduled', previewOpen: previewIsOpen });
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/scheduled')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleAssistantClick = () => {
    mark('perf.nav.click', 'nav_click', { target: '/assistants', previewOpen: previewIsOpen });
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/assistants')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleKnowledgeClick = () => {
    mark('perf.nav.click', 'nav_click', { target: '/knowledge-base', previewOpen: previewIsOpen });
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/knowledge-base')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleNoteClick = () => {
    mark('perf.nav.click', 'nav_click', { target: '/notes', previewOpen: previewIsOpen });
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/notes')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleMeetingRecordingClick = () => {
    mark('perf.nav.click', 'nav_click', { target: '/meeting-recording', previewOpen: previewIsOpen });
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/meeting-recording')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleWorkbenchClick = () => {
    mark('perf.nav.click', 'nav_click', { target: '/workbench', previewOpen: previewIsOpen });
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/workbench')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleTaskCenterClick = () => {
    mark('perf.nav.click', 'nav_click', { target: '/task-center', previewOpen: previewIsOpen });
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/task-center')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleThemeChange = useCallback(
    (next: 'light' | 'dark') => {
      void setTheme(next);
    },
    [setTheme]
  );

  // 应用市场还没有页面 —— 先弹一条提示占位,等页面就绪再换成真正的路由跳转。
  const handleAppMarketClick = useCallback(() => {
    Message.info(t('sider.appMarket.comingSoon'));
  }, [t]);

  const handleLogout = useCallback(async () => {
    cleanupSiderTooltips();
    blurActiveElement();
    // Hide the panel now so the UI responds immediately; the tabs themselves are
    // discarded after logout resolves, below.
    closePreview();
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      return; // logout 失败时不执行后续操作
    }
    // Discard this account's tabs from memory.
    //
    // `clearAuthCache` (inside logout) already deletes the stored `preview-ui:`
    // keys, but PreviewProvider is mounted at the app root and does not unmount on
    // logout, so its state survives. The persist effect depends on [tabs,
    // activeTabId, isOpen] and is still live — so the next change of any of those
    // would write this account's tabs straight back to disk, undoing the very
    // cleanup that ran moments earlier and showing them to whoever logs in next.
    //
    // Done after `await logout()` rather than before: discarding first would throw
    // the tabs away even on a path that left the user signed in. `logout()` handles
    // its own request failure and clears auth in a `finally`, so reaching this line
    // means the account really is signed out.
    clearPreviewForScope();
    if (onSessionClick) {
      onSessionClick();
    }
  }, [closePreview, clearPreviewForScope, logout, onSessionClick]);

  useEffect(() => {
    if (!showLogout) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        handleLogout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleLogout, showLogout]);

  const tooltipEnabled = collapsed && !isMobile;
  // Memoized: `getSiderTooltipProps` returns a fresh object on every call,
  // which used to invalidate the `groupedHistoryAfterPinned` memo below and
  // hand new props to the history list on every render.
  const siderTooltipProps = useMemo(() => getSiderTooltipProps(tooltipEnabled), [tooltipEnabled]);

  // Stable props for WorkspaceGroupedHistory — every prop is a fresh reference
  // on each render today, which defeats any future memo on the child. Memoizing
  // here so a downstream `React.memo` actually pays off.
  const workspaceHistoryProps = useMemo(
    () => ({
      collapsed,
      tooltipEnabled,
      onSessionClick,
      batchMode: isBatchMode,
      onBatchModeChange: setIsBatchMode,
    }),
    [collapsed, tooltipEnabled, onSessionClick, isBatchMode]
  );

  const groupedHistoryAfterPinned = useMemo(
    () => (
      <TeamSiderSection
        collapsed={collapsed}
        pathname={pathname}
        siderTooltipProps={siderTooltipProps}
        onSessionClick={onSessionClick}
      />
    ),
    [collapsed, pathname, siderTooltipProps, onSessionClick]
  );

  return (
    <div className='size-full flex flex-col'>
      {/* Main content area */}
      <div className='flex-1 min-h-0 overflow-hidden'>
        {isSettings ? (
          <Suspense fallback={<div className='size-full' />}>
            <SettingsSider collapsed={collapsed} tooltipEnabled={tooltipEnabled} />
          </Suspense>
        ) : (
          <div className='size-full flex flex-col'>
            {/* 固定导航区 —— 设计稿的 `<nav>`。
                收缩态:56px 磁贴居中、间距 8px、上下留白 10px;
                展开态:整行 32px、间距 4px、四周留白 8px。 */}
            <nav
              aria-label={t('sider.nav.ariaLabel')}
              className={classNames(
                'shrink-0 flex flex-col',
                collapsed ? 'items-center gap-8px py-10px' : 'gap-4px p-8px'
              )}
            >
              <SiderToolbar
                isMobile={isMobile}
                isBatchMode={isBatchMode}
                collapsed={collapsed}
                onNewChat={handleNewChat}
                onToggleBatchMode={() => setIsBatchMode((prev) => !prev)}
              />
              {/* Search entry — desktop moves this into the titlebar toolbar;
                  mobile keeps it here in the sidebar. */}
              {isMobile && (
                <SiderSearchEntry
                  isMobile={isMobile}
                  collapsed={collapsed}
                  siderTooltipProps={siderTooltipProps}
                  onConversationSelect={handleConversationSelect}
                  onSessionClick={onSessionClick}
                />
              )}
              {/* Assistant nav entry - fixed above Scheduled */}
              <SiderAssistantEntry
                isMobile={isMobile}
                isActive={pathname.startsWith('/assistants')}
                collapsed={collapsed}
                onClick={handleAssistantClick}
              />
              {/* Knowledge base nav entry - fixed below Assistant */}
              <SiderKnowledgeEntry
                isMobile={isMobile}
                isActive={pathname.startsWith('/knowledge-base')}
                collapsed={collapsed}
                onClick={handleKnowledgeClick}
              />
              {/* Notes nav entry - fixed below Knowledge base */}
              <SiderNoteEntry
                isMobile={isMobile}
                isActive={pathname.startsWith('/notes')}
                collapsed={collapsed}
                onClick={handleNoteClick}
              />
              {/* Meeting recording nav entry - fixed below Notes */}
              <SiderMeetingRecordingEntry
                isMobile={isMobile}
                isActive={pathname.startsWith('/meeting-recording')}
                collapsed={collapsed}
                onClick={handleMeetingRecordingClick}
              />
              {/* Workbench nav entry - opens external PM center in-app webview (enterprise only) */}
              {SiderWorkbenchEntry && (
                <SiderWorkbenchEntry
                  isMobile={isMobile}
                  isActive={pathname.startsWith('/workbench')}
                  collapsed={collapsed}
                  onClick={handleWorkbenchClick}
                />
              )}
              {/* Task Center nav entry - native task list page (enterprise only) */}
              {SiderTaskCenterEntry && (
                <SiderTaskCenterEntry
                  isMobile={isMobile}
                  isActive={pathname.startsWith('/task-center')}
                  collapsed={collapsed}
                  onClick={handleTaskCenterClick}
                />
              )}
              {/* Scheduled tasks nav entry - fixed above scroll */}
              <SiderScheduledEntry
                isMobile={isMobile}
                isActive={pathname === '/scheduled'}
                collapsed={collapsed}
                onClick={handleScheduledClick}
              />
              {/* 应用市场 —— 设计稿有这一项,产品里还没有对应路由,先占位。 */}
              <SiderAppMarketEntry
                isMobile={isMobile}
                isActive={false}
                collapsed={collapsed}
                onClick={handleAppMarketClick}
              />
            </nav>
            {/* Scrollable content: pinned → team (slot) → projects → conversations */}
            <div className={classNames('flex-1 min-h-0 overflow-y-auto', siderStyles.scrollArea)}>
              <Suspense fallback={<div className='min-h-200px' />}>
                <PerfProfiler id='groupedHistory'>
                  <WorkspaceGroupedHistory {...workspaceHistoryProps} afterPinnedContent={groupedHistoryAfterPinned} />
                </PerfProfiler>
              </Suspense>
            </div>
          </div>
        )}
      </div>
      {/* Footer —— 底部账号区 */}
      <SiderFooter
        isMobile={isMobile}
        isSettings={isSettings}
        collapsed={collapsed}
        theme={theme}
        userName={user?.username}
        onSettingsClick={handleSettingsClick}
        onThemeChange={handleThemeChange}
        showLogout={showLogout}
        onLogoutClick={handleLogout}
      />
    </div>
  );
};

// Memo-wrapped: Layout re-renders frequently (e.g. the `mainRow` ResizeObserver
// updates during the sider width animation), and it passes props through
// cloneElement. With a stable `onSessionClick` (useCallback on the Layout side)
// the shallow compare skips this entire subtree — including the conversation
// history list — on unrelated Layout renders.
export default React.memo(Sider);
