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
 * 列表**下方**另有一块「笔记分组」区(旧版的分类文件夹能力):列出所有笔记本,
 * 点一行按该分组筛上面的列表,「⋯」里是重命名 / 删除,标题右侧的「+」新建分组。
 * 分组区的增删改与右键菜单「移动到笔记本」共用同一套后端接口
 * (notebooks.list/create/update/delete + notes.update 的 notebook_id)。
 * 标题行兼折叠开关:点标题把分组列表收起来,只留标题这一行。
 *
 * 数据来源
 * ========
 * - `notes.list()` 不带 notebook_id 时返回全部笔记,正好对应设计稿的扁平列表。
 * - 搜索在**客户端**做:`ipcBridge.notes.list` 的路径构造器只支持
 *   notebook_id / tag / starred / limit / offset,没有 `q`,后端不认搜索词。
 * - 收藏用 `note.star`,筛选「收藏 N」直接数 `star` 为真的条目。
 * - 分类(元信息里的「产品设计」那一段)优先取标签,没有标签时退到笔记本名。
 */
import { AppIcon, ConfirmModal, IconButton, MoreMenu, cx } from '@aionui/ui';
import { Button, Input } from '@arco-design/web-react';
import type { RefInputType } from '@arco-design/web-react/es/Input/interface';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NoteItem, Notebook } from '../api/types';
import NoteContextMenu from './NoteContextMenu';
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
  /** 右键菜单「移动到笔记本」:把笔记挪到另一个分组。 */
  onMoveNoteToNotebook: (id: string, notebookId: string) => void;
  /**
   * 新建分组。
   *
   * `moveNoteId` 不为空时,建好把这条笔记挪进新分组 —— 右键菜单
   * 「移动到笔记本 › 新建笔记本」走的就是这条路径,和分组区的「+」共用一套表单。
   */
  onCreateNotebook: (name: string, moveNoteId: string | null) => Promise<void>;
  /** 重命名分组。 */
  onRenameNotebook: (id: string, name: string) => Promise<void>;
  /** 删除分组(连同组里的笔记)。 */
  onDeleteNotebook: (id: string) => Promise<void>;
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
  onMoveNoteToNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
}) => {
  const { t, i18n } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [ascending, setAscending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  /** 分组区:选中的分组 —— 上面的笔记列表按它筛。 */
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  /** 分组区:标题是不是收起来了(收起 = 只留标题行,给上面的笔记列表让出高度)。 */
  const [groupsCollapsed, setGroupsCollapsed] = useState(false);
  /** 分组区:行内新建 / 重命名。 */
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  const [renamingNotebookId, setRenamingNotebookId] = useState<string | null>(null);
  /** 新建分组时,要挪进新分组的笔记(右键菜单「新建笔记本」带来的)。 */
  const [pendingMoveNoteId, setPendingMoveNoteId] = useState<string | null>(null);
  const [draftNotebookName, setDraftNotebookName] = useState('');
  /** 待删的分组 —— 走共享层的二次确认弹窗。 */
  const [deleteNotebookId, setDeleteNotebookId] = useState<string | null>(null);
  const inputRef = useRef<RefInputType | null>(null);
  const groupInputRef = useRef<RefInputType | null>(null);
  /**
   * 行内编辑的提交去重 —— 回车提交后输入框会卸载,别把同一次提交做两遍
   * (新建两次分组 / 改名两次)。
   */
  const groupSubmitRef = useRef(false);

  useEffect(() => {
    if (!editingId) return;
    const handle = window.setTimeout(() => {
      const dom = inputRef.current?.dom as HTMLInputElement | undefined;
      inputRef.current?.focus();
      dom?.select();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [editingId]);

  /** 分组区的新建 / 重命名输入框:出现后自动聚焦并全选。 */
  useEffect(() => {
    if (!creatingNotebook && !renamingNotebookId) return;
    const handle = window.setTimeout(() => {
      const dom = groupInputRef.current?.dom as HTMLInputElement | undefined;
      groupInputRef.current?.focus();
      dom?.select();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [creatingNotebook, renamingNotebookId]);

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
      // 分组区选中的分组:列表只留这一组(没选就全留)。
      if (activeNotebookId !== null && note.notebookId !== activeNotebookId) return false;
      if (!query) return true;
      return [note.title, note.summary ?? '', note.content ?? ''].some((field) => field.toLowerCase().includes(query));
    });
  }, [notes, keyword, filter, activeNotebookId]);

  /** 每个分组里的笔记数 —— 分组行右侧的计数。 */
  const noteCountByNotebook = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach((note) => {
      if (!note.notebookId) return;
      counts.set(note.notebookId, (counts.get(note.notebookId) ?? 0) + 1);
    });
    return counts;
  }, [notes]);

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

  /*
   * 分组区(旧版的分类文件夹)
   * ========================
   * 新建 / 重命名都是**行内输入**:输入框直接出现在分组区里,回车提交、ESC 取消。
   * 删除走共享层的二次确认弹窗 —— 分组连同组里的笔记一起没了,得先问一句。
   */

  /** 开始新建分组。`moveNoteId` 不为空 = 右键菜单「新建笔记本」,建好要把笔记挪进去。 */
  const startCreateNotebook = useCallback((moveNoteId: string | null) => {
    groupSubmitRef.current = false;
    setCreatingNotebook(true);
    setRenamingNotebookId(null);
    setPendingMoveNoteId(moveNoteId);
    setDraftNotebookName('');
    // 分组区收着的时候建分组,得展开 —— 否则建完看不见。
    setGroupsCollapsed(false);
  }, []);

  const cancelCreateNotebook = useCallback(() => {
    setCreatingNotebook(false);
    setPendingMoveNoteId(null);
    setDraftNotebookName('');
  }, []);

  const commitCreateNotebook = useCallback(async () => {
    if (groupSubmitRef.current) return;
    groupSubmitRef.current = true;
    const name = draftNotebookName.trim();
    const moveNoteId = pendingMoveNoteId;
    setCreatingNotebook(false);
    setPendingMoveNoteId(null);
    setDraftNotebookName('');
    if (!name) return;
    try {
      await onCreateNotebook(name, moveNoteId);
    } catch (error) {
      console.error('[NotesListPanel] create notebook failed', error);
    }
  }, [draftNotebookName, onCreateNotebook, pendingMoveNoteId]);

  const startRenameNotebook = useCallback((id: string, name: string) => {
    groupSubmitRef.current = false;
    setRenamingNotebookId(id);
    setCreatingNotebook(false);
    setPendingMoveNoteId(null);
    setDraftNotebookName(name);
  }, []);

  const cancelRenameNotebook = useCallback(() => {
    setRenamingNotebookId(null);
    setDraftNotebookName('');
  }, []);

  const commitRenameNotebook = useCallback(async () => {
    if (groupSubmitRef.current) return;
    groupSubmitRef.current = true;
    const id = renamingNotebookId;
    const name = draftNotebookName.trim();
    setRenamingNotebookId(null);
    setDraftNotebookName('');
    if (!id || !name) return;
    try {
      await onRenameNotebook(id, name);
    } catch (error) {
      console.error('[NotesListPanel] rename notebook failed', error);
    }
  }, [draftNotebookName, onRenameNotebook, renamingNotebookId]);

  const requestDeleteNotebook = useCallback((id: string) => {
    setDeleteNotebookId(id);
  }, []);

  const cancelDeleteNotebook = useCallback(() => {
    setDeleteNotebookId(null);
  }, []);

  const confirmDeleteNotebook = useCallback(async () => {
    const id = deleteNotebookId;
    setDeleteNotebookId(null);
    if (!id) return;
    // 正在看的分组被删了 —— 筛选得跟着取消,否则列表会空着。
    setActiveNotebookId((current) => (current === id ? null : current));
    try {
      await onDeleteNotebook(id);
    } catch (error) {
      console.error('[NotesListPanel] delete notebook failed', error);
    }
  }, [deleteNotebookId, onDeleteNotebook]);

  /** 点分组行:按这个分组筛列表;点已选中的同一个 → 取消筛选。 */
  const toggleNotebookFilter = useCallback((id: string) => {
    setActiveNotebookId((current) => (current === id ? null : id));
  }, []);

  /** 取消分组筛选 —— 分组行上的「✕」和顶部「全部」都走它。 */
  const clearNotebookFilter = useCallback(() => {
    setActiveNotebookId(null);
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
      <NoteContextMenu
        key={note.id}
        note={note}
        notebooks={notebooks}
        onDelete={() => onDeleteNote(note.id)}
        onMoveToNotebook={(notebookId) => onMoveNoteToNotebook(note.id, notebookId)}
        onCreateNotebook={() => startCreateNotebook(note.id)}
        onToggleStar={() => onToggleStar(note.id)}
        onRename={() => startRename(note)}
      >
        <div className={cx(styles.item, isActive && styles.itemActive, note.star && styles.itemStarred)}>
          <Button
            type='text'
            aria-current={isActive}
            onClick={(event) => {
              // 点笔记本身只是选中,不能顺手把操作菜单弹出来(菜单的触发器是整行)。
              event.stopPropagation();
              onSelectNote(note.id);
            }}
            className={styles.itemMain}
          >
            {/*
              标题行。收藏过的笔记,标题前面给星星留出位置 ——
              星星是绝对定位在行上的独立按钮(见下面的 itemStar),
              所以这里只挪标题文字,摘要 / 元信息那一列不受影响。
            */}
            <span className={styles.itemTitle}>
              <span className={styles.itemTitleText}>
                {note.title || t('settings.notesUntitled', { defaultValue: 'Untitled note' })}
              </span>
            </span>
            <span className={styles.itemSummary}>{note.summary ?? ''}</span>
            {renderMeta(note)}
          </Button>
          {/*
            收藏标记 —— 标题行最左边的黄色星星,点它取消收藏。
            它是**独立按钮**,不是整行按钮的一部分:整行本身就是个 button,
            button 里不能再塞 button。点星星只切换收藏,不会顺手把笔记选中。
            还要 `stopPropagation`:整行的操作菜单监听的是 click,
            不拦住的话点星星会连菜单一起弹出来。
          */}
          {note.star && (
            <Button
              type='text'
              size='mini'
              icon={<AppIcon name='star' size={14} />}
              aria-label={t('settings.notesUnstar', { defaultValue: 'Remove from favorites' })}
              onClick={(event) => {
                event.stopPropagation();
                onToggleStar(note.id);
              }}
              className={styles.itemStar}
              data-testid={`notes-item-star-${note.id}`}
            />
          )}
          {/*
            行尾「⋯」:和右键是**同一个菜单**。
            这里不能 `stopPropagation` —— 点击要冒泡到整行的触发器,菜单才会弹出来。
          */}
          <Button
            type='text'
            size='small'
            icon={<AppIcon name='more-one' />}
            aria-label={t('settings.notesMoreActions', { defaultValue: 'More actions' })}
            className={cx(styles.itemMenu, '!rounded-8px !p-0 !text-t-tertiary hover:!bg-fill-2 hover:!text-t-primary')}
          />
        </div>
      </NoteContextMenu>
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
          aria-pressed={filter === 'all' && activeNotebookId === null}
          onClick={() => {
            // 「全部」= 什么都不筛:收藏筛选和分组筛选一起清掉。
            setFilter('all');
            clearNotebookFilter();
          }}
          className={cx(styles.filter, filter === 'all' && activeNotebookId === null && styles.filterActive)}
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

      {/*
        分组区 —— 笔记列表下方的「分类文件夹」。
        点一行 = 上面的笔记列表只留这一组;「⋯」里是重命名 / 删除;
        标题右侧的「+」是新建分组(右键菜单「新建笔记本」也走这一行的输入框)。
        标题本身是折叠开关:点一下把分组列表收起来,只留这一行标题。
      */}
      <section className={styles.groups} aria-label={t('settings.notesGroupsTitle', { defaultValue: 'Note Groups' })}>
        <div className={styles.groupsHead}>
          <h3 className={styles.groupsTitle}>
            <Button
              type='text'
              onClick={() => setGroupsCollapsed((collapsed) => !collapsed)}
              aria-expanded={!groupsCollapsed}
              className={styles.groupsToggle}
              data-testid='notes-groups-toggle'
            >
              <AppIcon name={groupsCollapsed ? 'right' : 'down'} size={12} className={styles.groupsChevron} />
              <span>{t('settings.notesGroupsTitle', { defaultValue: 'Note Groups' })}</span>
            </Button>
          </h3>
          <IconButton
            icon={<AppIcon name='plus' size={14} />}
            label={t('settings.notesCreateNotebook', { defaultValue: 'New group' })}
            onClick={() => startCreateNotebook(null)}
            className={styles.groupsCreate}
            data-testid='notes-create-notebook'
          />
        </div>

        {/*
          折叠动画:外层是 grid,行高在 `0fr` / `1fr` 之间过渡,高度跟着内容平滑变化。
          内容始终留在 DOM 里 —— 卸载了就量不到高度,动画会变成「啪」的一下;
          收起时用 `visibility: hidden` 把它从焦点顺序和读屏里摘掉。
        */}
        <div
          className={cx(styles.groupsCollapse, groupsCollapsed && styles.groupsCollapseClosed)}
          aria-hidden={groupsCollapsed}
          data-testid='notes-groups-collapse'
        >
          <div className={styles.groupsCollapseInner}>
            {creatingNotebook && (
              <Input
                ref={groupInputRef}
                size='mini'
                value={draftNotebookName}
                onChange={setDraftNotebookName}
                onPressEnter={() => void commitCreateNotebook()}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') cancelCreateNotebook();
                }}
                placeholder={t('settings.notesNotebookPlaceholder', { defaultValue: 'Group name' })}
                className={styles.groupInput}
                data-testid='notes-notebook-name-input'
              />
            )}

            {notebooks.length === 0 && !creatingNotebook ? (
              <p className={styles.groupsEmpty}>{t('settings.notesNoGroups', { defaultValue: 'No groups yet' })}</p>
            ) : (
              <div className={styles.groupsList}>
                {notebooks.map((notebook) => (
                  <div
                    key={notebook.id}
                    className={cx(styles.groupRow, activeNotebookId === notebook.id && styles.groupRowActive)}
                  >
                    {renamingNotebookId === notebook.id ? (
                      <Input
                        ref={groupInputRef}
                        size='mini'
                        value={draftNotebookName}
                        onChange={setDraftNotebookName}
                        onPressEnter={() => void commitRenameNotebook()}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') cancelRenameNotebook();
                        }}
                        placeholder={t('settings.notesNotebookPlaceholder', { defaultValue: 'Group name' })}
                        className={styles.groupInput}
                        data-testid='notes-notebook-rename-input'
                      />
                    ) : (
                      <>
                        <Button
                          type='text'
                          aria-pressed={activeNotebookId === notebook.id}
                          onClick={() => toggleNotebookFilter(notebook.id)}
                          className={styles.groupRowMain}
                          data-testid={`notes-notebook-${notebook.id}`}
                        >
                          <AppIcon name='folder-open' size={14} className={styles.groupRowIcon} />
                          <span className={styles.groupRowName}>{notebook.name}</span>
                        </Button>
                        {/*
                          被选中的分组,名字后面跟一个「✕」——「取消这一组的筛选」的明确入口。
                          (再点一次分组行也能取消,但那不明显)
                          悬停整行才显形 —— 平时列表是干净的。
                        */}
                        {activeNotebookId === notebook.id && (
                          <IconButton
                            icon={<AppIcon name='close-small' size={12} />}
                            label={t('settings.notesClearNotebookFilter', { defaultValue: 'Clear group filter' })}
                            onClick={clearNotebookFilter}
                            className={styles.groupRowClear}
                            data-testid={`notes-notebook-clear-${notebook.id}`}
                          />
                        )}
                        <span className={styles.groupRowCount} data-testid={`notes-notebook-count-${notebook.id}`}>
                          {noteCountByNotebook.get(notebook.id) ?? 0}
                        </span>
                        <MoreMenu
                          items={[
                            { key: 'rename', label: t('settings.notesRename', { defaultValue: 'Rename' }) },
                            {
                              key: 'delete',
                              label: t('settings.notesDeleteNotebook', { defaultValue: 'Delete group' }),
                              danger: true,
                            },
                          ]}
                          label={t('settings.notesMoreActions', { defaultValue: 'More actions' })}
                          onSelect={(key) => {
                            if (key === 'rename') startRenameNotebook(notebook.id, notebook.name);
                            else requestDeleteNotebook(notebook.id);
                          }}
                          className={styles.groupRowMenu}
                          data-testid={`notes-notebook-menu-${notebook.id}`}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <p className={styles.status}>
        {withCount(
          t('settings.notesListStatus', { count: notes.length, defaultValue: '{{count}} notes · Synced' }),
          notes.length
        )}
      </p>

      {/* 删分组:连同组里的笔记一起没了,先问一句。 */}
      <ConfirmModal
        visible={deleteNotebookId !== null}
        title={t('settings.notesDeleteNotebook', { defaultValue: 'Delete group' })}
        description={t('settings.notesDeleteNotebookConfirm', {
          defaultValue: 'Are you sure you want to delete this group and all its notes?',
        })}
        okText={t('common.delete', { defaultValue: 'Delete' })}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
        danger
        onCancel={cancelDeleteNotebook}
        onOk={() => void confirmDeleteNotebook()}
      />
    </aside>
  );
};

export default NotesListPanel;
