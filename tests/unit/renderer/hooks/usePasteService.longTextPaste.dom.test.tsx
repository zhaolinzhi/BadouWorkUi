/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

// All mocked at module level so the hook sees the mocks on import.
vi.mock('@/renderer/services/PasteService', () => ({
  PasteService: {
    init: vi.fn(),
    registerHandler: vi.fn(),
    unregisterHandler: vi.fn(),
    setLastFocusedComponent: vi.fn(),
    // Default: fall through to onTextPaste for plain text (no files).
    // Each test can override per-call to simulate specific behavior.
    handlePaste: vi.fn(),
  },
  createTempFile: vi.fn(),
}));

import { PasteService } from '@/renderer/services/PasteService';

vi.mock('@/renderer/hooks/file/useUploadState', () => ({
  trackUpload: () => ({
    onProgress: vi.fn(),
    finish: vi.fn(),
  }),
}));

vi.mock('@/renderer/services/FileService', () => ({
  uploadFileViaHttp: vi.fn(),
  getFileExtension: (n: string) => {
    const i = n.lastIndexOf('.');
    return i > -1 ? n.substring(i).toLowerCase() : '';
  },
  UPLOAD_ABORTED_ERROR: 'UPLOAD_ABORTED',
}));

vi.mock('@arco-design/web-react', () => ({
  Message: { error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const setUserAgent = (ua: string) => {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
};
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('usePasteService — long text paste', () => {
  let onFilesAdded: ReturnType<typeof vi.fn>;
  let onTextPaste: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onFilesAdded = vi.fn();
    onTextPaste = vi.fn();
    // Reset UA to non-iOS (iOS test sets it to iPhone UA without restoring).
    setUserAgent(DESKTOP_UA);
    // Default PasteService.handlePaste behavior: for plain-text paste (no files),
    // call onTextPaste with the clipboard text. Each test can override.
    (PasteService.handlePaste as ReturnType<typeof vi.fn>).mockImplementation(
      async (
        event: { clipboardData?: { getData: (t: string) => string; files?: unknown[] } },
        _supportedExts: unknown,
        _onFilesAdded: unknown,
        onTextPasteParam?: (text: string) => void,
        ..._rest: unknown[]
      ) => {
        const files = event.clipboardData?.files;
        if (files && files.length > 0) return false;
        if (onTextPasteParam && event.clipboardData) {
          onTextPasteParam(event.clipboardData.getData('text'));
          return true;
        }
        return false;
      }
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uploads 2000+ char text as file and calls onFilesAdded with pasted-text tag', async () => {
    const { createTempFile } = await import('@/renderer/services/PasteService');
    (createTempFile as ReturnType<typeof vi.fn>).mockResolvedValue('/tmp/pasted.txt');

    const { usePasteService } = await import('@/renderer/hooks/file/usePasteService');
    const { result } = renderHook(() =>
      usePasteService({
        supportedExts: ['.txt'],
        onFilesAdded,
        onTextPaste,
        conversation_id: 'conv-1',
      })
    );

    const text = 'a'.repeat(2000);
    const event = {
      clipboardData: { getData: (t: string) => (t === 'text' ? text : ''), files: [] },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.ClipboardEvent;

    await act(async () => {
      await result.current.onPaste(event);
    });

    expect(createTempFile).toHaveBeenCalled();
    expect(onFilesAdded).toHaveBeenCalledTimes(1);
    expect(onFilesAdded.mock.calls[0][0][0].tag).toBe('pasted-text');
    expect(onTextPaste).not.toHaveBeenCalled();
  });

  it('falls through to onTextPaste for 1999 chars', async () => {
    const { usePasteService } = await import('@/renderer/hooks/file/usePasteService');
    const { result } = renderHook(() =>
      usePasteService({
        supportedExts: ['.txt'],
        onFilesAdded,
        onTextPaste,
        conversation_id: 'conv-1',
      })
    );

    const text = 'a'.repeat(1999);
    const event = {
      clipboardData: { getData: (t: string) => (t === 'text' ? text : ''), files: [] },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.ClipboardEvent;

    await act(async () => {
      await result.current.onPaste(event);
    });

    expect(onFilesAdded).not.toHaveBeenCalled();
    expect(onTextPaste).toHaveBeenCalledWith(text);
  });

  it('does not trigger long-text branch when files present', async () => {
    const { usePasteService } = await import('@/renderer/hooks/file/usePasteService');
    const { result } = renderHook(() =>
      usePasteService({
        supportedExts: ['.txt'],
        onFilesAdded,
        onTextPaste,
        conversation_id: 'conv-1',
      })
    );

    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const text = 'a'.repeat(5000);
    const event = {
      clipboardData: {
        getData: (t: string) => (t === 'text' ? text : ''),
        files: [file],
      },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.ClipboardEvent;

    await act(async () => {
      await result.current.onPaste(event);
    });

    expect(onFilesAdded).not.toHaveBeenCalled();
  });

  it('falls back to onTextPaste when upload fails', async () => {
    const { createTempFile } = await import('@/renderer/services/PasteService');
    (createTempFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));

    const { Message } = await import('@arco-design/web-react');
    const { usePasteService } = await import('@/renderer/hooks/file/usePasteService');
    const { result } = renderHook(() =>
      usePasteService({
        supportedExts: ['.txt'],
        onFilesAdded,
        onTextPaste,
        conversation_id: 'conv-1',
      })
    );

    const text = 'a'.repeat(2000);
    const event = {
      clipboardData: { getData: (t: string) => (t === 'text' ? text : ''), files: [] },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.ClipboardEvent;

    await act(async () => {
      await result.current.onPaste(event);
    });

    expect(Message.error).toHaveBeenCalled();
    expect(onTextPaste).toHaveBeenCalledWith(text);
  });

  it('skips long-text branch on iOS', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    const { createTempFile } = await import('@/renderer/services/PasteService');
    (createTempFile as ReturnType<typeof vi.fn>).mockResolvedValue('/tmp/x.txt');

    const { usePasteService } = await import('@/renderer/hooks/file/usePasteService');
    const { result } = renderHook(() =>
      usePasteService({
        supportedExts: ['.txt'],
        onFilesAdded,
        onTextPaste,
        conversation_id: 'conv-1',
      })
    );

    const text = 'a'.repeat(2000);
    const event = {
      clipboardData: { getData: (t: string) => (t === 'text' ? text : ''), files: [] },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.ClipboardEvent;

    await act(async () => {
      await result.current.onPaste(event);
    });

    expect(createTempFile).not.toHaveBeenCalled();
    expect(onFilesAdded).not.toHaveBeenCalled();
  });

  it('exposes getPastedOriginalText after paste, undefined after forget', async () => {
    const { createTempFile } = await import('@/renderer/services/PasteService');
    (createTempFile as ReturnType<typeof vi.fn>).mockResolvedValue('/tmp/x.txt');

    const { usePasteService } = await import('@/renderer/hooks/file/usePasteService');
    const { result } = renderHook(() =>
      usePasteService({
        supportedExts: ['.txt'],
        onFilesAdded,
        onTextPaste,
        conversation_id: 'conv-1',
      })
    );

    const text = 'hello world ' + 'a'.repeat(2000);
    const event = {
      clipboardData: { getData: (t: string) => (t === 'text' ? text : ''), files: [] },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.ClipboardEvent;

    await act(async () => {
      await result.current.onPaste(event);
    });

    expect(result.current.getPastedOriginalText('/tmp/x.txt')).toBe(text);
    act(() => {
      result.current.forgetPastedOriginalText('/tmp/x.txt');
    });
    expect(result.current.getPastedOriginalText('/tmp/x.txt')).toBeUndefined();
  });

  it('getPastedTextInlineAction returns node for pasted text path, undefined otherwise', async () => {
    const { createTempFile } = await import('@/renderer/services/PasteService');
    (createTempFile as ReturnType<typeof vi.fn>).mockResolvedValue('/tmp/x.txt');

    const { usePasteService } = await import('@/renderer/hooks/file/usePasteService');
    const { result } = renderHook(() =>
      usePasteService({
        supportedExts: ['.txt'],
        onFilesAdded,
        onTextPaste,
        conversation_id: 'conv-1',
      })
    );

    const text = 'a'.repeat(2000);
    const event = {
      clipboardData: { getData: (t: string) => (t === 'text' ? text : ''), files: [] },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.ClipboardEvent;

    await act(async () => {
      await result.current.onPaste(event);
    });

    const action = result.current.getPastedTextInlineAction('/tmp/x.txt', () => {});
    expect(action).toBeTruthy();

    const otherAction = result.current.getPastedTextInlineAction('/tmp/not-pasted.txt', () => {});
    expect(otherAction).toBeUndefined();
  });
});
