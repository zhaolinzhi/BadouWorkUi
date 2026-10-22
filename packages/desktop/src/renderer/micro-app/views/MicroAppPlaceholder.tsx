import React, { Suspense, lazy } from 'react';
import { Spin } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { getMicroAppConfig } from '../config/micro-apps';

const MicroAppHost = lazy(() => import('../components/MicroAppHost').then((m) => ({ default: m.MicroAppHost })));

export interface MicroAppPlaceholderProps {
  microAppName: string;
}

const Loading: React.FC = () => {
  const { t } = useTranslation();
  // 绝对定位覆盖容器区域:容器是 `flex-1`,会永久占满剩余高度,若 Loading 走
  // 正常文档流就会被挤到视口外看不见。
  return (
    <div className='absolute inset-0 z-10 flex items-center justify-center'>
      <Spin tip={t('common.loading')} />
    </div>
  );
};

const ErrorFallback: React.FC<{ name: string; error?: Error }> = ({ name, error }) => {
  const { t } = useTranslation();
  return (
    <div className='absolute inset-0 z-10 overflow-auto p-16px text-t-1'>
      <div className='text-16px font-medium mb-8px'>{t('common.internalPage.title', { name })}</div>
      <div className='text-12px text-t-secondary'>{error?.message ?? 'unknown'}</div>
    </div>
  );
};

interface MicroAppPlaceholderState {
  hasError: boolean;
  error?: Error;
}

class MicroAppErrorBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  MicroAppPlaceholderState
> {
  state: MicroAppPlaceholderState = { hasError: false };

  static getDerivedStateFromError(error: Error): MicroAppPlaceholderState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[MicroAppPlaceholder] "${this.props.name}" crashed:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback name={this.props.name} error={this.state.error} />;
    }
    return this.props.children;
  }
}

export const MicroAppPlaceholder: React.FC<MicroAppPlaceholderProps> = ({ microAppName }) => {
  const config = getMicroAppConfig(microAppName);
  const containerId = `${microAppName}-container`;

  return (
    // 高度链:子应用根节点用 `h-full`(height:100%),百分比高度要求祖先有确定高度。
    // 这条链上 shell 侧有三层 —— 本节点、`#<name>-container`、qiankun 运行时插入的
    // wrapper。缺任意一层,子应用都会退化成内容高度(下方留白)。
    //
    // wrapper 由 qiankun 的 `processTpl` 生成:
    //   <div id="__qiankun_microapp_wrapper_for_<name>__" data-name=... data-version=...>
    // 它只有 id、没有 className,样式只能靠子选择器下发。用 `[id*=qiankun]` 匹配
    // 而不是写死完整 id —— id 里含 `snakeCase(name)`,跨子应用不一样。
    <div
      className='micro-app-placeholder relative flex h-full min-h-0 flex-col overflow-hidden'
      data-micro-app={microAppName}
    >
      <div id={containerId} className='min-h-0 flex-1 overflow-hidden [&>[id*=qiankun]]:h-full' />

      <MicroAppErrorBoundary name={microAppName}>
        <Suspense fallback={<Loading />}>
          <MicroAppHost
            name={config.name}
            entry={config.entry}
            container={config.container}
            activeRule={config.activeRule}
          />
        </Suspense>
      </MicroAppErrorBoundary>
    </div>
  );
};
