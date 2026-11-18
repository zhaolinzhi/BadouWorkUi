/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import RecordingListPage from '../pages/RecordingListPage';
import RecordingDetailPage from '../pages/RecordingDetailPage';

export function createRouter(routerBase: string) {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: React.createElement(RecordingListPage),
      },
      {
        path: 'list/:id',
        element: React.createElement(RecordingDetailPage),
      },
    ],
    { initialEntries: ['/'] }
  );
}

export { RouterProvider };
