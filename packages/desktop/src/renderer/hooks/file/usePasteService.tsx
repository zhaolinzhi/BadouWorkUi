import type { FileMetadata } from '@/renderer/services/FileService';
import type { UploadSource } from '@/renderer/hooks/file/useUploadState';
import type { ImageCounter } from '@/renderer/services/PasteService';
import { PasteService, createTempFile } from '@/renderer/services/PasteService';
import React, { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '@arco-design/web-react';
import { uuid } from '@renderer/utils/common';

interface UsePasteServiceProps {
  supportedExts: string[];
  onFilesAdded?: (files: FileMetadata[]) => void;
  onTextPaste?: (text: string) => void;
  /** Conversation ID for WebUI file uploads */
  conversation_id?: string;
  source?: UploadSource;
}

/**
 * Threshold for "long text" paste handling. When trimmed plain-text paste
 * length reaches or exceeds this value, the paste service uploads the text as
 * a `.txt` attachment rather than dumping it into the textarea. Lives inline
 * here (rather than in `@/renderer/constants/paste`) because only the hook
 * references it — no consumer needs to share it.
 */
const LONG_PASTE_THRESHOLD = 2000;

export interface UsePasteServiceResult {
  onFocus: () => void;
  onPaste: (event: React.ClipboardEvent) => Promise<boolean>;
  getPastedOriginalText: (filePath: string) => string | undefined;
  forgetPastedOriginalText: (filePath: string) => void;
  getPastedTextInlineAction: (filePath: string, onRemove: () => void) => ReactNode | undefined;
}

/**
 * 通用PasteService集成hook
 * 为所有组件提供统一的粘贴处理功能
 */
export const usePasteService = ({
  supportedExts,
  onFilesAdded,
  onTextPaste,
  conversation_id,
  source = 'sendbox',
}: UsePasteServiceProps): UsePasteServiceResult => {
  const { t } = useTranslation();
  const componentId = useRef('paste-service-' + uuid(4)).current;

  // Per-mount counters and text cache. Lives for the SendBox mount; cleared on
  // unmount. Not persisted across refresh (matches existing upload semantics).
  const pastedImageCounter = useRef(0);
  const pastedTextCounter = useRef(0);
  const pastedTextByPath = useRef<Map<string, string>>(new Map());
  // Track latest onTextPaste via ref so the inline-action callback always
  // reads the freshest closure without forcing consumers to memo.
  const onTextPasteRef = useRef(onTextPaste);
  useEffect(() => {
    onTextPasteRef.current = onTextPaste;
  }, [onTextPaste]);

  const imageCounter = useMemo<ImageCounter>(
    () => ({
      next: () => ++pastedImageCounter.current,
    }),
    []
  );

  const getPastedOriginalText = useCallback((filePath: string) => pastedTextByPath.current.get(filePath), []);

  const forgetPastedOriginalText = useCallback((filePath: string) => {
    pastedTextByPath.current.delete(filePath);
  }, []);

  const getPastedTextInlineAction = useCallback(
    (filePath: string, onRemove: () => void): ReactNode => {
      const originalText = pastedTextByPath.current.get(filePath);
      if (originalText === undefined) {
        return undefined;
      }
      return (
        <button
          type='button'
          className='text-11px text-t-secondary underline cursor-pointer bg-transparent border-0 p-0 inline-block text-left'
          style={{ lineHeight: '16px' }}
          onClick={() => {
            forgetPastedOriginalText(filePath);
            onTextPasteRef.current?.(originalText);
            onRemove();
          }}
        >
          {t('conversation.sendbox.pasteOriginalText')}
        </button>
      );
    },
    [forgetPastedOriginalText, t]
  );

  // Long-text → file branch. Runs BEFORE delegating to PasteService.handlePaste.
  // Triggers on plain text paste (no files) when trimmed length ≥ threshold.
  const tryLongTextAsFile = useCallback(
    async (event: React.ClipboardEvent): Promise<boolean> => {
      const text = event.clipboardData?.getData('text');
      if (!text || text.trim().length < LONG_PASTE_THRESHOLD) {
        return false;
      }
      const files = event.clipboardData?.files;
      if (files && files.length > 0) {
        return false; // file paste wins; long-text branch is plain-text only
      }
      // iOS short-circuit: match existing PasteService behaviour
      if (typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent)) {
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const seq = ++pastedTextCounter.current;
        const file_name = `粘贴的文本-${String(seq).padStart(3, '0')}.txt`;
        const tempPath = await createTempFile(file_name, data, 'text/plain;charset=utf-8', conversation_id, source);
        if (!tempPath) {
          // Cancelled — do not fall back; user explicitly aborted the upload.
          return true;
        }
        const fileMeta: FileMetadata = {
          name: file_name,
          path: tempPath,
          size: data.byteLength,
          type: 'text/plain',
          lastModified: Date.now(),
          tag: 'pasted-text',
        };
        pastedTextByPath.current.set(tempPath, text);
        onFilesAdded?.([fileMeta]);
        return true;
      } catch (error) {
        if (error instanceof Error && error.message === 'FILE_TOO_LARGE') {
          Message.error(t('common.fileAttach.tooLarge'));
        } else {
          Message.error(t('common.fileAttach.failed'));
        }
        // Fall back to native paste so the user doesn't lose their text.
        onTextPaste?.(text);
        return true;
      }
    },
    [conversation_id, onFilesAdded, onTextPaste, source, t]
  );

  // 统一的粘贴事件处理
  const handlePaste = useCallback(
    async (event: React.ClipboardEvent) => {
      // 检查是否有文件，如果有文件立即阻止默认行为
      const files = event.clipboardData?.files;
      if (files && files.length > 0) {
        event.preventDefault();
        event.stopPropagation();
      }

      try {
        // 长文本 → 文件分支先于 PasteService.handlePaste（plain text only）
        const longTextHandled = await tryLongTextAsFile(event);
        if (longTextHandled) {
          return true;
        }

        const handled = await PasteService.handlePaste(
          event,
          supportedExts,
          onFilesAdded || (() => {}),
          onTextPaste,
          conversation_id,
          source,
          imageCounter
        );
        if (handled && (!files || files.length === 0)) {
          // 如果不是文件粘贴但被处理了（比如纯文本粘贴），也阻止默认行为
          event.preventDefault();
          event.stopPropagation();
        }
        return handled;
      } catch (err) {
        Message.error(t('common.fileAttach.failed'));
        return false;
      }
    },
    [conversation_id, source, supportedExts, onFilesAdded, onTextPaste, imageCounter, t, tryLongTextAsFile]
  );

  // 焦点处理
  const handleFocus = useCallback(() => {
    PasteService.setLastFocusedComponent(componentId);
  }, [componentId]);

  // 注册粘贴处理器
  useEffect(() => {
    PasteService.init();
    PasteService.registerHandler(componentId, handlePaste);

    return () => {
      PasteService.unregisterHandler(componentId);
    };
  }, [componentId, handlePaste]);

  return {
    onFocus: handleFocus,
    onPaste: handlePaste,
    getPastedOriginalText,
    forgetPastedOriginalText,
    getPastedTextInlineAction,
  };
};
