/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import Vditor from 'vditor';
import 'vditor/dist/index.css';
import React, { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';

type VditorTheme = 'light' | 'dark';

interface VditorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  onLeaveFirstLine?: (content: string) => void;
  theme: VditorTheme;
  placeholder?: string;
}

/**
 * 「更多」按钮的图标。
 *
 * Vditor 的自定义工具栏项把 `icon` 原样塞进 innerHTML,而工具栏按钮默认
 * `font-size: 0`(图标靠 svg 撑开),纯文本的「···」会看不见 —— 所以这里塞一段
 * `currentColor` 的 SVG,颜色跟着主题走。
 */
const MORE_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
  '<circle cx="3.5" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="12.5" cy="8" r="1.5" /></svg>';

/**
 * 工具栏的功能项 —— 顺序对齐设计稿笔记页的 `.notes-formatting`:
 * 撤销/重做 → 插入 → 粗体/斜体/删除线/高亮 → 正文 → 列表/待办/缩进 →
 * 链接等 → 全屏/编辑模式/更多。
 *
 * 这里只调整**顺序**,功能项仍然是 Vditor 自带的(外观由 CSS 改成设计稿样式)。
 */
const TOOLBAR: Array<string | IMenuItem> = [
  'undo',
  'redo',
  '|',
  'insert-after',
  'insert-before',
  '|',
  'bold',
  'italic',
  'strike',
  'inline-code',
  '|',
  'headings',
  '|',
  'list',
  'ordered-list',
  'check',
  'indent',
  'outdent',
  '|',
  'link',
  'upload',
  'table',
  'code',
  'quote',
  'line',
  'emoji',
  '|',
  'fullscreen',
  'edit-mode',
];

/** 组装完整工具栏 —— 末尾追加「更多」分组(它的提示文案要走 i18n)。 */
const buildToolbar = (moreTip: string): Array<string | IMenuItem> => [
  ...TOOLBAR,
  {
    name: 'more',
    icon: MORE_ICON,
    tip: moreTip,
    toolbar: ['both', 'code-theme', 'content-theme', 'export', 'outline', 'preview', 'devtools', 'help'],
  },
];

const VditorEditor: React.FC<VditorEditorProps> = ({
  value,
  onChange,
  onBlur,
  onLeaveFirstLine,
  theme,
  placeholder,
}) => {
  const ctx = useAppContext();
  const { t } = useTranslation();
  const baseApi = ctx.baseApi;
  const token = ctx.token;
  const rawId = useId();
  const containerId = `vditor-${rawId.replace(/:/g, '')}`;
  const vditorRef = useRef<Vditor | null>(null);
  // `new Vditor()` returns synchronously but vditor.lute is set only after the
  // async lute.min.js script load — getValue()/setValue() throw until then.
  const readyRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;
  const onLeaveFirstLineRef = useRef(onLeaveFirstLine);
  onLeaveFirstLineRef.current = onLeaveFirstLine;
  // Track whether the cursor was previously inside the first block so
  // we only fire onLeaveFirstLine on the *transition* out, not on every
  // selection change while already outside.
  const wasInFirstBlockRef = useRef(false);
  const leaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Capture the latest `value` so the `after` callback (set once at mount) can
  // sync whatever the prop has become by the time lute finishes loading.
  const valueRef = useRef(value);
  valueRef.current = value;
  // Vditor 实例只创建一次,语言切换后不重建 —— 提示文案用 ref 带进去。
  const moreTipRef = useRef(t('settings.notesMore', { defaultValue: '更多' }));
  moreTipRef.current = t('settings.notesMore', { defaultValue: '更多' });

  useEffect(() => {
    const vditor = new Vditor(containerId, {
      value,
      mode: 'wysiwyg',
      lang: 'zh_CN',
      theme: theme === 'dark' ? 'dark' : 'classic',
      placeholder: placeholder ?? '',
      height: '100%',
      toolbar: buildToolbar(moreTipRef.current),
      cache: { enable: false },
      cdn: './vditor',
      // Vditor calls `options.customWysiwygToolbar(type, popover)` whenever
      // the user interacts with a wysiwyg block (footnote, blockquote, table,
      // heading, etc.). The option is typed as optional, but Vditor 3.11.x
      // invokes it unconditionally without a null check, throwing on the
      // first interaction. A no-op preserves the default empty popover and
      // unblocks the input event chain.
      customWysiwygToolbar: () => {},
      after: () => {
        readyRef.current = true;
        // The value effect below already runs on prop changes, but if the prop
        // change arrived BEFORE lute finished loading, that effect saw
        // readyRef=false and skipped. Catch up here.
        if (vditor.vditor && vditor.getValue() !== valueRef.current) {
          vditor.setValue(valueRef.current);
        }
      },
      upload: {
        url: `${baseApi}/fs/upload`,
        fieldName: 'file',
        accept: 'image/*',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        success: async (_editorElement: HTMLElement, responseText: string) => {
          try {
            const response = JSON.parse(responseText) as {
              success: boolean;
              data?: string;
            };
            if (!response.success || !response.data) return;
            // Replaces the main app's `ipcBridge.fs.getImageBase64.invoke({ path })`:
            // that bridge just POSTs to `/api/fs/image-base64` with `{ path }`.
            // The endpoint returns an envelope `{ success, data }`; in the main
            // app `httpRequest` (httpBridge.ts:244-250) auto-unwraps `.data`,
            // so the IPC bridge returns the raw data URL string. Here we call
            // `fetch` directly and must unwrap `data` ourselves — otherwise
            // Vditor's markdown template string would toString the object as
            // `[object Object]` and the image would not render.
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;
            const base = baseApi.endsWith('/') ? baseApi.slice(0, -1) : baseApi;
            const suffix = '/fs/image-base64';
            const base64Url = await fetch(`${base}${suffix}`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ path: response.data }),
            }).then(async (res) => {
              if (!res.ok) return '';
              const text = await res.text();
              try {
                const parsed = JSON.parse(text) as string | { data?: string };
                return typeof parsed === 'string' ? parsed : (parsed.data ?? '');
              } catch {
                return text;
              }
            });
            if (!base64Url) return;
            const fileName = response.data.split(/[\\/]/).pop() || 'image';
            vditorRef.current?.insertValue(`![${fileName}](${base64Url})`);
          } catch (error) {
            console.error('[Vditor] Upload error:', error);
          }
        },
      },
      input: (newValue: string) => {
        onChangeRef.current(newValue);
      },
      blur: (newValue: string) => {
        // Vditor invokes `blur` with the current Markdown, not the
        // wysiwyg HTML — the hook works off the HTML it already cached
        // in `valueRef`, but we forward the latest content so callers
        // get a fresh read anyway.
        onBlurRef.current?.(valueRef.current || newValue);
      },
    });
    vditorRef.current = vditor;

    return () => {
      // Flush the title commit before destroying so switching notes or
      // closing the panel doesn't lose the last edit.
      onBlurRef.current?.(valueRef.current);
      if (vditor.vditor) {
        vditor.destroy();
      }
      vditorRef.current = null;
      readyRef.current = false;
      if (leaveDebounceRef.current) {
        clearTimeout(leaveDebounceRef.current);
        leaveDebounceRef.current = null;
      }
    };
  }, []);

  // Listen for cursor leaving the first line via native selectionchange.
  // Vditor's built-in `select` callback only fires when the user has
  // actually selected text (selectText.trim() !== ''), so clicking to
  // move the caret or using arrow keys never triggers it.
  useEffect(() => {
    const handler = () => {
      const editorEl = document.getElementById(containerId);
      if (!editorEl) return;
      const firstBlock = editorEl.querySelector<HTMLElement>('.vditor-reset > :first-child');
      if (!firstBlock) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const isInFirst = firstBlock.contains(range.startContainer);

      if (wasInFirstBlockRef.current && !isInFirst) {
        // Grab the current Markdown straight from Vditor so the title
        // sync doesn't depend on the debounced `input` callback having
        // already written the latest content to lastContentRef.
        let currentContent = '';
        if (readyRef.current) {
          try {
            currentContent = vditorRef.current?.getValue() ?? '';
          } catch {
            // getValue() throws before lute finishes loading — safe to ignore.
          }
        }
        if (leaveDebounceRef.current) clearTimeout(leaveDebounceRef.current);
        leaveDebounceRef.current = setTimeout(() => {
          onLeaveFirstLineRef.current?.(currentContent);
        }, 200);
      }
      wasInFirstBlockRef.current = isInFirst;
    };

    document.addEventListener('selectionchange', handler);
    return () => {
      document.removeEventListener('selectionchange', handler);
      if (leaveDebounceRef.current) {
        clearTimeout(leaveDebounceRef.current);
        leaveDebounceRef.current = null;
      }
    };
  }, [containerId]);

  useEffect(() => {
    const vditor = vditorRef.current;
    if (readyRef.current && vditor?.vditor && vditor.getValue() !== value) {
      vditor.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    const vditor = vditorRef.current;
    if (vditor?.vditor) {
      vditor.setTheme(theme === 'dark' ? 'dark' : 'classic');
    }
  }, [theme]);

  return <div id={containerId} className='h-full w-full' />;
};

export default VditorEditor;
