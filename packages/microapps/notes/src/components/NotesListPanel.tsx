/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 笔记列表面板 —— 对齐设计稿 BadouWork-Desktop-Handoff 的 `.notes-list-panel`。
 *
 * 设计稿里的左栏是**扁平的笔记列表**:标题 + 「+ 新建」、搜索框、
 * 「全部 N / 收藏 N / 最近编辑」筛选行、按时间分组的条目(标题 + 两行摘要 +
 * 「时间 · 分类」)、底部「N 篇笔记 · 已同步」。**没有笔记本树** ——
 * 新建笔记落到默认笔记本,所以这里不再渲染 notebook 层级的入口。
 *
 * 数据来源
 * ========
 * - `notes.list()` 不带 notebook_id 时返回全部笔记,正好对应设计稿的扁平列表。
 * - 搜索在**客户端**做:`ipcBridge.notes.list` 的路径构造器只支持
 *   notebook_id / tag / starred / limit / offset,没有 `q`,后端不认搜索词。
 * - 收藏用 `note.star`,筛选「收藏 N」直接数 `star` 为真的条目。
 * - 分类(元信息里的「产品设计」那一段)优先取标签,没有标签时退到笔记本名。
 */
import { AppIcon, MoreMenu, cx } from '@aionui/ui';
import { Button, Input } from '@arco-design/web-react';
import type { RefInputType } from '@arco-design/web-react/es/Input/interface';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NoteItem, Notebook } from '../api/types';
import styles from './NotesListPanel.module.css';

const DAY_MS = 24 * 60 * 60 * 1000;

type Filter = 'all' | 'favorites';

/** 时间分组:今天 / 过去 7 天 / 更早。 */
type TimeGroup = 'today' | 'last7days' | 'older';

const GROUP_ORDER: TimeGroup[] = ['today', 'last7days', 'older'];

type NotesListPanelProps = {
  notes: NoteItem[];
  notebooks: Notebook[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onToggleStar: (id: string) => void;
  onRenameNote: (id: string, title: string) => void;
  onDeleteNote: (id: string) => void;
};

const startOfToday = (now: number): number => {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const groupOf = (updatedAt: string, now: number): TimeGroup => {
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return 'older';
  const today = startOfToday(now);
  if (ts >= today) return 'today';
  if (ts >= today - 7 * DAY_MS) return 'last7days';
  return 'older';
};

const pad2 = (value: number): string => (value < 10 ? `0${value}` : String(value));

/**
 * i18next 的插值只在接管了 shell 的 i18n 实例时生效;独立运行(直接 vite dev)
 * 时 `t()` 只会原样返回 defaultValue,`{{count}}` 会裸露在界面上。
 * 这里兜底替换一次 —— 已经插值好的文案不含占位符,替换是空操作。
 */
const withCount = (text: string, count: number): string => text.replace(/\{\{count\}\}/g, String(count));

/** 元信息里的时间:今天显示时分,昨天显示「昨天」,更早显示日期。 */
const formatMetaTime = (updatedAt: string, now: number, locale: string | undefined, yesterdayLabel: string): string => {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return '';
  const ts = date.getTime();
  const today = startOfToday(now);
  if (ts >= today) return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (ts >= today - DAY_MS) return yesterdayLabel;
  try {
    return date.toLocaleDateString(locale, { month: 'long', day: 'numeric' });
  } catch {
    return date.toLocaleDateString();
  }
};

const NotesListPanel: React.FC<NotesListPanelProps> = ({
  notes,
  notebooks,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onToggleStar,
  onRenameNote,
  onDeleteNote,
}) => {
  const { t, i18n } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [ascending, setAscending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const inputRef = useRef<RefInputType | null>(null);

  useEffect(() => {
    if (!editingId) return;
    const handle = window.setTimeout(() => {
      const dom = inputRef.current?.dom as HTMLInputElement | undefined;
      inputRef.current?.focus();
      dom?.select();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [editingId]);

  const notebookNames = useMemo(() => {
    const map = new Map<string, string>();
    notebooks.forEach((notebook) => map.set(notebook.id, notebook.name));
    return map;
  }, [notebooks]);

  const favoriteCount = useMemo(() => notes.filter((note) => note.star).length, [notes]);

  /** 关键词过滤在客户端做 —— 后端的列表接口没有 `q` 参数。 */
  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return notes.filter((note) => {
      if (filter === 'favorites' && !note.star) return false;
      if (!query) return true;
      return [note.title, note.summary ?? '', note.content ?? ''].some((field) => field.toLowerCase().includes(query));
    });
  }, [notes, keyword, filter]);

  const groups = useMemo(() => {
    const now = Date.now();
    const buckets = new Map<TimeGroup, NoteItem[]>();
    GROUP_ORDER.forEach((key) => buckets.set(key, []));
    const sorted = [...filtered].sort((a, b) => {
      const diff = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return ascending ? diff : -diff;
    });
    sorted.forEach((note) => {
      buckets.get(groupOf(note.updatedAt, now))?.push(note);
    });
    return GROUP_ORDER.map((key) => ({ key, notes: buckets.get(key) ?? [] })).filter((group) => group.notes.length > 0);
  }, [filtered, ascending]);

  const groupLabel = useCallback(
    (key: TimeGroup) => {
      if (key === 'today') return t('settings.notesGroupToday', { defaultValue: 'Today' });
      if (key === 'last7days') return t('settings.notesGroupLast7Days', { defaultValue: 'Past 7 days' });
      return t('settings.notesGroupOlder', { defaultValue: 'Older' });
    },
    [t]
  );

  const metaTime = useCallback(
    (note: NoteItem) =>
      formatMetaTime(
        note.updatedAt,
        Date.now(),
        i18n?.language,
        t('settings.notesGroupYesterday', { defaultValue: 'Yesterday' })
      ),
    [i18n?.language, t]
  );

  /** 元信息里的分类:标签优先,没有标签时退到笔记本名。 */
  const metaCategory = useCallback(
    (note: NoteItem) => {
      if (note.tags && note.tags.length > 0) return note.tags.join(' / ');
      if (note.notebookId) return notebookNames.get(note.notebookId) ?? '';
      return '';
    },
    [notebookNames]
  );

  const startRename = useCallback((note: NoteItem) => {
    setEditingId(note.id);
    setDraftTitle(note.title);
  }, []);

  const commitRename = useCallback(() => {
    if (!editingId) return;
    const trimmed = draftTitle.trim();
    const target = notes.find((note) => note.id === editingId);
    if (trimmed && target && trimmed !== target.title) {
      onRenameNote(editingId, trimmed);
    }
    setEditingId(null);
  }, [draftTitle, editingId, notes, onRenameNote]);

  const cancelRename = useCallback(() => {
    setEditingId(null);
  }, []);

  const renderMeta = (note: NoteItem) => {
    const time = metaTime(note);
    const category = metaCategory(note);
    if (!time && !category) return null;
    if (!category) return <span className={styles.itemMeta}>{time}</span>;
    return (
      <span className={styles.itemMeta}>
        {time ? `${time} · ` : ''}
        {category}
      </span>
    );
  };

  const renderItem = (note: NoteItem) => {
    const isActive = note.id === activeNoteId;
    if (editingId === note.id) {
      return (
        <div key={note.id} className={styles.item}>
          <div className={styles.itemEdit}>
            <Input
              ref={inputRef}
              size='mini'
              value={draftTitle}
              onChange={setDraftTitle}
              onPressEnter={commitRename}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === 'Escape') cancelRename();
              }}
              placeholder={t('settings.notesNotePlaceholder', { defaultValue: 'Note title' })}
            />
          </div>
        </div>
      );
    }
    return (
      <div key={note.id} className={cx(styles.item, isActive && styles.itemActive)}>
        <Button type='text' aria-current={isActive} onClick={() => onSelectNote(note.id)} className={styles.itemMain}>
          <span className={styles.itemTitle}>
            {note.title || t('settings.notesUntitled', { defaultValue: 'Untitled note' })}
          </span>
          <span className={styles.itemSummary}>{note.summary ?? ''}</span>
          {renderMeta(note)}
        </Button>
        <MoreMenu
          className={styles.itemMenu}
          label={t('settings.notesMoreActions', { defaultValue: 'More actions' })}
          onClick={(event) => event.stopPropagation()}
          onSelect={(key) => {
            if (key === 'star') onToggleStar(note.id);
            if (key === 'rename') startRename(note);
            if (key === 'delete') onDeleteNote(note.id);
          }}
          items={[
            {
              key: 'star',
              label: note.star
                ? t('settings.notesUnstar', { defaultValue: 'Remove from favorites' })
                : t('settings.notesStar', { defaultValue: 'Favorite' }),
              icon: <AppIcon name='star' size={14} />,
            },
            {
              key: 'rename',
              label: t('settings.notesRename', { defaultValue: 'Rename' }),
              icon: <AppIcon name='file-text' size={14} />,
            },
            {
              key: 'delete',
              label: t('settings.notesDeleteNote', { defaultValue: 'Delete note' }),
              icon: <AppIcon name='delete' size={14} />,
              danger: true,
            },
          ]}
        />
      </div>
    );
  };

  return (
    <aside className={styles.panel} aria-label={t('settings.notes', { defaultValue: 'Notes' })}>
      <div className={styles.heading}>
        <h2 className={styles.headingTitle}>{t('settings.notes', { defaultValue: 'Notes' })}</h2>
        <Button
          icon={<AppIcon name='plus' size={14} />}
          onClick={onCreateNote}
          className={styles.newButton}
          data-testid='notes-create'
        >
          {t('settings.notesCreate', { defaultValue: 'New' })}
        </Button>
      </div>

      <div className={styles.search}>
        {/*
          图标放在 Input 外面:设计稿的搜索框是
          「28×28 图标容器 + 8px 间距 + 无内边距的 input」,
          Arco 的 prefix 结构(自带前缀占位与 input 左内边距)对不齐,
          所以这里只把 Input 当纯文本框用。
        */}
        <AppIcon name='search' size={14} className={styles.searchIcon} />
        <Input
          value={keyword}
          onChange={setKeyword}
          placeholder={t('settings.notesSearchPlaceholder', {
            defaultValue: 'Search notes by title or content',
          })}
          className={styles.searchInput}
          allowClear
          data-testid='notes-search'
        />
      </div>

      <div className={styles.filters}>
        <Button
          type='text'
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
          className={cx(styles.filter, filter === 'all' && styles.filterActive)}
          data-testid='notes-filter-all'
        >
          {withCount(
            t('settings.notesFilterAll', { count: notes.length, defaultValue: 'All {{count}}' }),
            notes.length
          )}
        </Button>
        <Button
          type='text'
          aria-pressed={filter === 'favorites'}
          onClick={() => setFilter('favorites')}
          className={cx(styles.filter, filter === 'favorites' && styles.filterActive)}
          data-testid='notes-filter-favorites'
        >
          {withCount(
            t('settings.notesFilterFavorites', { count: favoriteCount, defaultValue: 'Favorites {{count}}' }),
            favoriteCount
          )}
        </Button>
        <Button
          type='text'
          onClick={() => setAscending((value) => !value)}
          className={cx(styles.sort, ascending && styles.sortAscending)}
          data-testid='notes-sort'
        >
          <AppIcon name='down' size={12} className={styles.sortIcon} />
          {t('settings.notesSortByUpdated', { defaultValue: 'Last edited' })}
        </Button>
      </div>

      <div className={styles.items}>
        {groups.length === 0 ? (
          <p className={styles.empty}>{t('settings.notesEmpty', { defaultValue: 'No notes found' })}</p>
        ) : (
          groups.map((group) => (
            <section key={group.key} className={styles.group}>
              <h3 className={styles.groupTitle}>{groupLabel(group.key)}</h3>
              {group.notes.map(renderItem)}
            </section>
          ))
        )}
      </div>

      <p className={styles.status}>
        {withCount(
          t('settings.notesListStatus', { count: notes.length, defaultValue: '{{count}} notes · Synced' }),
          notes.length
        )}
      </p>
    </aside>
  );
};

export default NotesListPanel;
