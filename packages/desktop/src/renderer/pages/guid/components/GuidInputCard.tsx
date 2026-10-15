/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import FilePreview from '@/renderer/components/media/FilePreview';
import UploadProgressBar from '@/renderer/components/media/UploadProgressBar';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { useCompositionInput } from '@/renderer/hooks/chat/useCompositionInput';
import { Input } from '@arco-design/web-react';
import type { RefTextAreaType } from '@arco-design/web-react/es/Input';
import AtFileMenu from '@/renderer/components/chat/AtFileMenu';
import { useAtMentionItems } from '@/renderer/hooks/chat/useAtMentionItems';
import {
  buildAtFileInsertion,
  getActiveAtFileQuery,
  getAllAtFileQueries,
  resolveAtFileMenuKey,
} from '@/renderer/utils/chat/atFileQuery';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../index.module.css';
import GuidWorkspaceFootnote from './GuidWorkspaceFootnote';

type GuidInputCardProps = {
  focusRequestKey?: string;
  // Input state
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onPaste: React.ClipboardEventHandler;
  onFocus: () => void;
  onBlur: () => void;
  placeholder: string;

  // Styling
  isInputActive: boolean;
  isFileDragging: boolean;
  activeBorderColor: string;
  inactiveBorderColor: string;
  activeShadow: string;
  dragHandlers: React.HTMLAttributes<HTMLDivElement>;

  // Files
  files: string[];
  onRemoveFile: (path: string) => void;
  /**
   * Per-file inline action rendered under the filename (e.g. "paste original
   * text" link for long-text paste chips). Returns `undefined` for normal uploads.
   */
  getInlineAction?: (path: string, onRemove: () => void) => React.ReactNode | undefined;

  // Action row
  actionRow: React.ReactNode;
  slashCommandMenu?: React.ReactNode;

  // Workspace
  workspaceDir: string;
  onSelectWorkspace: (dir: string) => void;
  onClearWorkspace: () => void;
};

const GuidInputCard: React.FC<GuidInputCardProps> = ({
  focusRequestKey,
  input,
  onInputChange,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur,
  placeholder,
  isInputActive,
  isFileDragging,
  activeBorderColor,
  inactiveBorderColor,
  activeShadow,
  dragHandlers,
  files,
  onRemoveFile,
  getInlineAction,
  actionRow,
  slashCommandMenu,
  workspaceDir,
  onSelectWorkspace,
  onClearWorkspace,
}) => {
  const { t } = useTranslation();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { compositionHandlers, isComposing } = useCompositionInput();
  const inputRef = useRef<RefTextAreaType | null>(null);
  const textareaAutoSize = isMobile ? { minRows: 2, maxRows: 8 } : { minRows: 2, maxRows: 20 };

  // KB-only @ mention (Guid does not support file @-mentions).
  const [caretPosition, setCaretPosition] = useState(0);
  const [atMenuActiveIndex, setAtMenuActiveIndex] = useState(0);
  const activeAtFileQuery = useMemo(() => getActiveAtFileQuery(input, caretPosition), [caretPosition, input]);
  const isKbMenuOpen = Boolean(activeAtFileQuery);
  const atMention = useAtMentionItems({
    query: activeAtFileQuery?.query ?? '',
    isOpen: isKbMenuOpen,
    limit: 8,
  });
  const kbMenuItems = useMemo(() => atMention.items.filter((i) => i.kind === 'kb'), [atMention.items]);

  const allAtFileQueries = useMemo(() => getAllAtFileQueries(input), [input]);

  // Splice a KB item into the input at the active @ query position.
  const insertSelectedKbItem = (item: (typeof kbMenuItems)[number]) => {
    if (!activeAtFileQuery) return;
    const text = buildAtFileInsertion(item);
    if (!text) return;
    const before = input.slice(0, activeAtFileQuery.start);
    const after = input.slice(activeAtFileQuery.end);
    const next = `${before}${text}${after}`;
    onInputChange(next);
    const nextCaret = activeAtFileQuery.start + text.length;
    setCaretPosition(nextCaret);
    requestAnimationFrame(() => {
      inputRef.current?.dom.setSelectionRange(nextCaret, nextCaret);
    });
  };

  // Keyboard navigation for the KB menu (overrides normal onKeyDown while open).
  const handleKbMenuKeyDown = (event: React.KeyboardEvent) => {
    if (!isKbMenuOpen || !activeAtFileQuery || kbMenuItems.length === 0) {
      onKeyDown(event);
      return;
    }
    if (isComposing.current) {
      onKeyDown(event);
      return;
    }
    const action = resolveAtFileMenuKey(event.key, kbMenuItems.length > 0);
    if (action === 'dismiss') {
      onKeyDown(event);
      return;
    }
    event.preventDefault();
    if (action === 'down') {
      setAtMenuActiveIndex((prev) => (prev + 1) % kbMenuItems.length);
      return;
    }
    if (action === 'up') {
      setAtMenuActiveIndex((prev) => (prev === 0 ? kbMenuItems.length - 1 : prev - 1));
      return;
    }
    if (action === 'accept') {
      const item = kbMenuItems[atMenuActiveIndex];
      if (item) insertSelectedKbItem(item);
    }
  };

  useEffect(() => {
    if (!focusRequestKey || isMobile) return;
    inputRef.current?.focus();
    inputRef.current?.dom.setSelectionRange(input.length, input.length);
  }, [focusRequestKey, input, isMobile]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isComposing.current) return;
    if (isKbMenuOpen && kbMenuItems.length > 0) {
      handleKbMenuKeyDown(e);
      return;
    }
    onKeyDown(e);
  };

  const borderColor = isFileDragging
    ? 'rgb(var(--primary-3))'
    : isInputActive
      ? activeBorderColor
      : inactiveBorderColor;

  return (
    <div
      className={`${styles.guidInputCardWrap} guid-input-card-shell relative rd-24px flex flex-col ${slashCommandMenu || isKbMenuOpen ? 'overflow-visible' : 'overflow-hidden'} transition-all duration-200 ${isFileDragging ? 'b b-solid border-dashed guid-input-card-shell--dragging' : ''}`}
      style={{
        zIndex: 1,
        transition: 'box-shadow 0.25s ease',
        width: isMobile ? 'calc(100% + 28px)' : undefined,
        marginLeft: isMobile ? -14 : undefined,
        marginRight: isMobile ? -14 : undefined,
        ...(isFileDragging
          ? {
              backgroundColor: 'var(--color-primary-light-1)',
              borderColor: 'rgb(var(--primary-3))',
              borderWidth: '1px',
            }
          : {
              boxShadow: isInputActive ? activeShadow : 'none',
            }),
      }}
      {...dragHandlers}
    >
      {/* inner white card — narrower than outer wrap */}
      <div
        className={`${styles.guidInputInner} ${isKbMenuOpen ? 'overflow-visible' : ''} relative p-12px flex flex-col bg-dialog-fill-0`}
        style={{
          transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
          borderColor: isFileDragging ? 'rgb(var(--primary-3))' : borderColor,
          boxShadow: isInputActive && !isFileDragging ? activeShadow : 'none',
        }}
      >
        <Input.TextArea
          ref={inputRef}
          autoSize={textareaAutoSize}
          placeholder={placeholder}
          spellCheck={false}
          className={`sendbox-highlight-textarea text-14px focus:b-none rounded-xl !bg-transparent !b-none !resize-none !py-0 !pr-0 !pl-7px ${styles.lightPlaceholder}`}
          value={input}
          onChange={onInputChange}
          onSelect={(event) => {
            const target = event.target as HTMLTextAreaElement | null;
            if (target) setCaretPosition(target.selectionStart ?? input.length);
          }}
          onPaste={onPaste}
          onFocus={onFocus}
          onBlur={onBlur}
          {...compositionHandlers}
          onKeyDown={handleKeyDown}
          data-testid='guid-input'
        />
        {allAtFileQueries.length > 0 && (
          <div
            aria-hidden='true'
            className='sendbox-highlight-layer'
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'transparent',
              // The textarea has `!py-0` (no vertical padding) and `pl-7px`
              // for its left text inset. The overlay mirrors only the
              // left inset so the KB badge sits at the same horizontal
              // origin as plain text. Vertical inset is left at 0 — adding
              // paddingTop / paddingBottom here would offset the overlay
              // text baseline away from the (transparent) textarea text
              // and re-introduce the "two @kb names" double-rendering
              // symptom.
              paddingLeft: 12,
            }}
          >
            {(() => {
              const segments: React.ReactNode[] = [];
              let cursor = 0;
              allAtFileQueries.forEach((match, index) => {
                if (cursor < match.start) {
                  segments.push(
                    <span className='sendbox-highlight-text' key={`t-${cursor}`}>
                      {input.slice(cursor, match.start)}
                    </span>
                  );
                }
                if (match.token.startsWith('@kb:')) {
                  // Token form is "@kb:<name>" after the renderer-visible
                  // rename; render the whole segment as one blue badge so the
                  // user sees the KB name, not the kbId. The kbId itself is
                  // recovered at send time by the GuidPage resolver.
                  segments.push(
                    <span
                      key={`kb-${match.start}-${index}`}
                      data-testid='kb-mention-badge'
                      title={t('conversation.atMenu.kbBadgeTitle', { defaultValue: 'Cited knowledge base' })}
                      style={{
                        background: 'color-mix(in srgb, var(--color-primary-light-1, #e6f4ff) 80%, transparent)',
                        color: 'var(--color-primary-6, #165dff)',
                        borderRadius: '6px',
                        padding: '0 4px',
                        margin: '0 2px',
                      }}
                    >
                      {match.token}
                    </span>
                  );
                  cursor = match.end;
                } else {
                  segments.push(
                    <span key={`m-${match.start}-${index}`} style={{ color: 'var(--color-primary-6, #165dff)' }}>
                      {input.slice(match.start, match.end)}
                    </span>
                  );
                  cursor = match.end;
                }
              });
              if (cursor < input.length) {
                segments.push(
                  <span className='sendbox-highlight-text' key={`tail-${cursor}`}>
                    {input.slice(cursor)}
                  </span>
                );
              }
              return segments;
            })()}
          </div>
        )}
        <div style={{ height: 12, flexShrink: 0 }} aria-hidden='true' />
        {files.length > 0 && (
          <div className='flex flex-wrap items-center gap-8px mt-12px mb-12px'>
            {files.map((path) => (
              <FilePreview
                key={path}
                path={path}
                inlineAction={getInlineAction?.(path, () => onRemoveFile(path))}
                onRemove={() => onRemoveFile(path)}
              />
            ))}
          </div>
        )}
        <UploadProgressBar source='sendbox' />
        {actionRow}
        {slashCommandMenu && (
          <div className='absolute left-0 right-0 top-[calc(100%+4px)] z-70'>{slashCommandMenu}</div>
        )}
      </div>
      {isKbMenuOpen && (
        <div
          className='absolute left-12px right-12px bottom-[calc(100%+8px)] z-70 pointer-events-auto'
          style={{ zIndex: 70 }}
        >
          <AtFileMenu
            activeIndex={atMenuActiveIndex}
            emptyText={
              atMention.loading
                ? t('conversation.atMenu.loadingKb', { defaultValue: 'Loading knowledge bases…' })
                : t('kb-chat.empty', { defaultValue: 'No knowledge bases available' })
            }
            items={kbMenuItems}
            label={t('conversation.atMenu.kbSectionTitle', { defaultValue: 'Knowledge bases' })}
            loading={atMention.loading}
            loadingText={t('conversation.atMenu.loadingKb', { defaultValue: 'Loading knowledge bases…' })}
            onHoverItem={setAtMenuActiveIndex}
            onSelectItem={insertSelectedKbItem}
            getSubtitle={() => t('conversation.atMenu.kbSectionTitle', { defaultValue: 'Knowledge bases' })}
          />
        </div>
      )}
      <GuidWorkspaceFootnote
        workspaceDir={workspaceDir}
        onSelectWorkspace={onSelectWorkspace}
        onClearWorkspace={onClearWorkspace}
      />
    </div>
  );
};

export default GuidInputCard;
