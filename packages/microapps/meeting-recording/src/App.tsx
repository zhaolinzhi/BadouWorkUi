import React, { useEffect, useMemo, useState } from 'react';
import { ConfigProvider } from '@arco-design/web-react';
import enUS from '@arco-design/web-react/es/locale/en-US';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';
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

  const router = useMemo(() => createRouter(routerBase), [routerBase]);
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
