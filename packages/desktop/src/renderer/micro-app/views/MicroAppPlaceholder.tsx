import React, { Suspense, lazy, useCallback, useState } from 'react';
import { Spin } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { getMicroAppConfig } from '../config/micro-apps';
import type { MicroAppMountState } from '../components/MicroAppHost';

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
      <div className='text-16px font-medium mb-8px'>{t('common.error')}</div>
      <div className='text-12px text-t-secondary'>{error?.message ?? name}</div>
    </div>
  );
};

interface MicroAppErrorBoundaryProps {
  name: string;
  /** 捕获到子应用崩溃时通知外层,由外层统一渲染错误页。 */
  onError: (name: string, error: Error) => void;
  children: React.ReactNode;
}

/**
 * 子应用(或其加载过程)抛错时的兜底。
 *
 * 只负责**上报**:错误页由 placeholder 统一渲染,避免同时出现两份错误提示
 * (loading 覆盖层和错误页会叠在一起)。
 */
class MicroAppErrorBoundary extends React.Component<MicroAppErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[MicroAppPlaceholder] "${this.props.name}" crashed:`, error, info);
    this.props.onError(this.props.name, error);
  }

  render() {
    // 错误页由 placeholder 渲染,这里不再重复渲染一份。
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export const MicroAppPlaceholder: React.FC<MicroAppPlaceholderProps> = ({ microAppName }) => {
  const config = getMicroAppConfig(microAppName);
  const containerId = `${microAppName}-container`;

  /*
   * 挂载状态由 MicroAppHost 上报(它的 `mountPromise` resolve 才代表子应用
   * 真的挂上了)。在这之前容器里只有 qiankun 的空 wrapper,界面上就是白屏 ——
   * 子应用首次拉取 + 编译本来就慢(同事反馈"放着不管过会儿自己就好了"就是
   * 挂载耗时太长,期间全程白屏),所以这段时间必须给 loading 反馈。
   *
   * 状态里带上应用名:同一个 placeholder 实例可能被复用去渲染另一个子应用
   * (React Router 换路由时组件类型相同,React 会复用实例),这时旧应用
   * 的「已挂载」不能算数 —— 名字对不上就当还在 loading。
   */
  const [mount, setMount] = useState<{ name: string; state: MicroAppMountState; error?: Error }>({
    name: microAppName,
    state: 'loading',
  });

  /*
   * 回调必须**稳定引用**:MicroAppHost 内部把它走 ref 转发(不进 useEffect
   * 依赖),传内联箭头函数也不会导致子应用反复重挂。这里用 useCallback 只是
   * 为了不产生多余的重渲染。
   */
  const handleMountStateChange = useCallback(
    (state: MicroAppMountState, error?: Error) => {
      setMount({ name: microAppName, state, error });
    },
    [microAppName]
  );

  const handleCrash = useCallback((name: string, error: Error) => {
    setMount({ name, state: 'failed', error });
  }, []);

  const mountState = mount.name === microAppName ? mount.state : 'loading';
  const mountError = mount.name === microAppName ? mount.error : undefined;

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

      {/*
       * 挂载期间的 loading 覆盖层放在容器**外面**、placeholder 根节点里面:
       * 容器是 `flex-1`(永久占满剩余高度),loading 若走正常文档流会被挤到
       * 视口外看不见,必须绝对定位盖住容器区域。
       *
       * 它同时覆盖两段时间:lazy chunk 加载(Suspense 期间)和 qiankun 真正的
       * 挂载过程。挂载失败时换成错误页,不再无限转圈。
       */}
      {mountState === 'loading' && <Loading />}
      {mountState === 'failed' && <ErrorFallback name={microAppName} error={mountError} />}

      <MicroAppErrorBoundary name={microAppName} onError={handleCrash}>
        {/*
         * fallback 传 null:loading 已经由上面的覆盖层统一负责,这里再来一个
         * 会出现两份 loading 文案。
         */}
        <Suspense fallback={null}>
          <MicroAppHost
            name={config.name}
            entry={config.entry}
            container={config.container}
            activeRule={config.activeRule}
            onMountStateChange={handleMountStateChange}
          />
        </Suspense>
      </MicroAppErrorBoundary>
    </div>
  );
};
