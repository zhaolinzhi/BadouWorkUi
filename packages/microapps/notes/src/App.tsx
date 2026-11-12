import React, { useEffect, useState } from 'react';
import { ConfigProvider } from '@arco-design/web-react';
import enUS from '@arco-design/web-react/es/locale/en-US';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';
import { useRouter } from '@aionui/microapp-shared';
import { AppContext, type AppContextValue } from './AppContext';
import { createRouter, RouterProvider } from './router';

export interface AppProps {
  context: AppContextValue;
  routerBase: string;
}

const ARCO_LOCALES: Record<string, typeof enUS> = {
  'en-US': enUS,
  'zh-CN': zhCN,
};

const App: React.FC<AppProps> = ({ context, routerBase }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(context.theme);
  const [locale, setLocale] = useState<string>(context.locale);

  useEffect(() => {
    const offTheme = context.on('theme:change', (next) => {
      const t = (next as { theme?: unknown })?.theme;
      if (t === 'light' || t === 'dark') {
        setTheme(t);
      }
    });
    const offLocale = context.on('locale:change', (next) => {
      const l = (next as { locale?: unknown })?.locale;
      if (typeof l === 'string') {
        setLocale(l);
      }
    });
    return () => {
      offTheme();
      offLocale();
    };
  }, [context]);

  // Arco 通过 body 上的 `arco-theme` 属性切换深浅色;ConfigProvider 的 theme prop
  // 仅用于主题色配置,不能直接接受 light/dark 字符串。
  useEffect(() => {
    document.body.setAttribute('arco-theme', theme);
    return () => {
      document.body.removeAttribute('arco-theme');
    };
  }, [theme]);

  /*
   * Router 用**按 base 缓存的单例**拿,不在 render 阶段反复创建。
   *
   * 原来这里是 `useMemo(() => createRouter(routerBase), [routerBase])` ——
   * useMemo 的工厂在 React render 阶段执行,`createMemoryRouter()` 会在
   * 渲染过程中跑。子应用**第二次打开**时,react-router 内部的
   * `new DataRoutes()`(私有字段走 WeakMap)会抛:
   *
   *   TypeError: r.has is not a function
   *
   * `useRouter` 内部用 `useState` 的惰性初值(只在首次渲染求值)取 router,
   * 并按 `routerBase` 缓存 —— 第二次打开时 `createRouter` 根本不会被调用,
   * 崩溃的那句也就不会执行第二次。详见 @aionui/microapp-shared 的
   * qiankun/router.ts。
   */
  const router = useRouter(routerBase, createRouter);
  const arcoLocale = ARCO_LOCALES[locale] ?? zhCN;

  return (
    <ConfigProvider locale={arcoLocale}>
      <AppContext.Provider value={context}>
        <RouterProvider router={router} />
      </AppContext.Provider>
    </ConfigProvider>
  );
};

export default App;
export { App };
