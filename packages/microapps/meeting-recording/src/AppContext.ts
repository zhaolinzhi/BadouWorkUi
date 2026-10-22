import { createContext, useContext } from 'react';
import type { MicroAppProps } from '@renderer/micro-app/types';

export type AppContextValue = MicroAppProps;

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within AppContext.Provider');
  }
  return ctx;
}
