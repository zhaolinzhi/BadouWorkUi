/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

// WebviewHost needs a real Electron <webview>; stub it as a marker element
// so this test exercises the page's card → webview → back flow in jsdom.
vi.mock('@renderer/components/media/WebviewHost', () => ({
  __esModule: true,
  default: (props: { url: string }) => <div data-testid='mock-webview' data-url={props.url} />,
}));

vi.mock('@renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
  openExternalUrl: vi.fn(),
}));

vi.mock('@renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({ status: 'authenticated', user: { id: 'u1', username: 'alice', token: 'token-123' } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import WorkbenchPage from '@/renderer/pages/workbench/WorkbenchPage';

afterEach(() => {
  cleanup();
});

describe('WorkbenchPage — in-page webview flow', () => {
  it('shows the card grid initially', () => {
    render(<WorkbenchPage />);
    expect(screen.getByText('workbench.title')).toBeInTheDocument();
    expect(screen.getByTestId('workbench-app-badou-cloud')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-webview')).not.toBeInTheDocument();
  });

  it('opens the in-page webview with a Token URL when a card is clicked', async () => {
    const user = userEvent.setup();
    render(<WorkbenchPage />);
    await user.click(screen.getByTestId('workbench-app-badou-cloud'));

    await waitFor(() => {
      const webview = screen.getByTestId('mock-webview');
      expect(webview.getAttribute('data-url')).toContain('http://pm.badousoft.com/center');
      expect(webview.getAttribute('data-url')).toContain('Token=token-123');
    });
    expect(screen.getByText('workbench.back')).toBeInTheDocument();
  });

  it('returns to the card grid when the back button is clicked', async () => {
    const user = userEvent.setup();
    render(<WorkbenchPage />);
    await user.click(screen.getByTestId('workbench-app-ksp'));
    await waitFor(() => expect(screen.getByTestId('mock-webview')).toBeInTheDocument());

    await user.click(screen.getByText('workbench.back'));
    await waitFor(() => expect(screen.queryByTestId('mock-webview')).not.toBeInTheDocument());
    expect(screen.getByTestId('workbench-app-ksp')).toBeInTheDocument();
  });
});
