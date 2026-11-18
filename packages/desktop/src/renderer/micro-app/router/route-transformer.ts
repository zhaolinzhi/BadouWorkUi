import React from 'react';
import type { RouteObject } from 'react-router-dom';
import { MicroAppPlaceholder } from '../views/MicroAppPlaceholder';
import { InternalPage } from '../../components/layout/InternalPage';

export interface BackendMenuItem {
  id: string;
  titleKey: string;
  icon?: string;
  path: string;
  type: 'internal' | 'microApp';
  microAppName?: string;
  activeRule?: string;
  order: number;
  parentId?: string;
}

export function deriveActiveRule(item: BackendMenuItem): string {
  if (item.activeRule) return item.activeRule;
  const segments = item.path.split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Cannot derive activeRule from path: "${item.path}"`);
  }
  return `/${segments[0]}`;
}

export function transformMenuToRoute(item: BackendMenuItem): RouteObject {
  if (item.type === 'microApp') {
    if (!item.microAppName) {
      throw new Error(`Menu item "${item.id}" has type=microApp but missing microAppName`);
    }
    const activeRule = deriveActiveRule(item);
    return {
      path: activeRule,
      element: React.createElement(MicroAppPlaceholder, { microAppName: item.microAppName }),
      handle: { isMicroApp: true, microAppName: item.microAppName, menuItem: item },
    };
  }
  return {
    path: item.path,
    element: React.createElement(InternalPage, { routeKey: item.id }),
    handle: { isMicroApp: false, menuItem: item },
  };
}
