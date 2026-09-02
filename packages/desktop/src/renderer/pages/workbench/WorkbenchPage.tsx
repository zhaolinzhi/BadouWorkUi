/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Spin } from '@arco-design/web-react';
import { ArrowLeft } from '@icon-park/react';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import WebviewHost from '@renderer/components/media/WebviewHost';
import { BROWSER_SESSION_PARTITION } from '@/common/config/constants';
import { WORKBENCH_APPS } from './apps';
import { useWorkbenchAppLauncher } from './useWorkbenchAppLauncher';

const WorkbenchPage: React.FC = () => {
  const { status } = useAuth();
  const { t } = useTranslation();
  const { activeUrl, launch, close, setActiveUrl } = useWorkbenchAppLauncher();

  if (status === 'checking') {
    return (
      <div className='size-full flex items-center justify-center'>
        <Spin />
      </div>
    );
  }

  // An app is open: show the in-page webview with a back bar to the cards.
  if (activeUrl) {
    return (
      <div className='size-full min-w-0 flex flex-col overflow-hidden bg-bg-2'>
        <div className='flex shrink-0 items-center gap-8px border-b border-[var(--color-border-2)] px-12px py-6px'>
          <Button size='small' onClick={close} icon={<ArrowLeft />}>
            {t('workbench.back', { defaultValue: '返回工作台' })}
          </Button>
          <span className='min-w-0 flex-1 truncate text-12px text-t-tertiary'>{activeUrl}</span>
        </div>
        <div className='min-h-0 flex-1'>
          <WebviewHost
            url={activeUrl}
            partition={BROWSER_SESSION_PARTITION}
            showNavBar
            className='bg-bg-1'
            onUrlChange={setActiveUrl}
          />
        </div>
      </div>
    );
  }

  if (WORKBENCH_APPS.length === 0) {
    return (
      <div className='size-full flex items-center justify-center'>
        <Empty description={t('workbench.empty', { defaultValue: '暂无可用应用' })} />
      </div>
    );
  }

  return (
    <div className='size-full min-w-0 overflow-hidden bg-bg-2'>
      <div className='size-full overflow-y-auto overflow-x-hidden'>
        <div className='mx-auto w-full max-w-960px min-w-0 px-20px py-16px'>
          <div className='mb-12px'>
            <h1 className='m-0 text-16px font-600 text-t-primary'>{t('workbench.title')}</h1>
            <p className='m-0 mt-2px text-12px text-t-tertiary'>
              {t('workbench.subtitle', { defaultValue: '点击应用卡片，使用当前账号登录跳转' })}
            </p>
          </div>

          <div className='grid min-w-0 grid-cols-2 gap-8px sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
            {WORKBENCH_APPS.map((app) => (
              <div
                key={app.id}
                role='button'
                tabIndex={0}
                data-testid={`workbench-app-${app.id}`}
                className='group flex min-w-0 cursor-pointer flex-col gap-6px rounded-10px border border-solid border-[var(--color-border-2)] bg-bg-1 px-12px py-10px shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:border-b-light hover:bg-primary-1'
                onClick={() => void launch(app)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void launch(app);
                  }
                }}
              >
                <div className='flex min-w-0 items-center gap-8px'>
                  <div className='size-24px flex shrink-0 items-center justify-center rounded-6px bg-primary-1 text-primary-6 text-12px font-600 group-hover:bg-bg-1'>
                    {app.name.slice(0, 1)}
                  </div>
                  <span className='min-w-0 truncate text-13px font-500 text-t-primary'>{app.name}</span>
                </div>
                {app.description && (
                  <span className='min-w-0 truncate text-11px text-t-tertiary'>{app.description}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkbenchPage;
