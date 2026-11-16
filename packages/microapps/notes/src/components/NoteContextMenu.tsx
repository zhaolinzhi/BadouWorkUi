/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 笔记条目的操作菜单 —— **右键和行尾「⋯」是同一个菜单**。
 *
 * 菜单结构对齐设计稿(笔记列表里的右键菜单):
 *
 *   添加到知识库 ›
 *   移动到笔记本 ›
 *   ──────────────
 *   收藏 / 取消收藏
 *   重命名
 *   创建副本
 *   独立窗口打开
 *   ──────────────
 *   删除
 *
 * 「移动到笔记本」是二级菜单:第一项「新建笔记本」,下面列出**具体的分组名**
 * (笔记本列表),笔记当前所属的分组打勾。
 *
 * 实现取舍
 * ========
 * - 用 Arco `Dropdown`:触发方式同时挂 `contextMenu` 与 `click`,所以**整行右键**
 *   和**行尾「⋯」点击**弹出的是同一个弹层 —— 行尾按钮的点击事件冒泡到这一层。
 *   「⋯」自己不能 `stopPropagation`,而笔记标题的点击要 `stopPropagation`,
 *   否则点笔记会顺手把菜单弹出来。
 * - `alignPoint`:弹层贴着光标 —— 右键时在右键处,点「⋯」时在按钮处,两种触发
 *   位置都对。Arco 的 `Dropdown` 只在 `trigger === 'contextMenu'` 时默认开这个
 *   开关,触发方式改成数组后要自己通过 `triggerProps` 打开。
 * - 弹层挂 `document.body` —— qiankun 容器有 `overflow`,留在容器里会被裁掉
 *   (与共享层 `MoreMenu` 同一个约束)。
 * - `Dropdown` 只在 droplist **直接**是 `Menu` 时才接管「点菜单项后收起」,
 *   所以 `Menu` 必须是 droplist 的直接子节点,中间不能包一层 div。
 * - 二级菜单用 Arco 的 `Menu.SubMenu`:悬停展开,点完自动收起。
 *
 * 「添加到知识库」
 * ==============
 * 二级菜单里列的是**真实知识库**:数据来自与知识库微应用同一套 AIPaaS
 * `listJSON.do`(见 `api/knowledgeBases.ts`),列表状态挂在页面上
 * (`useKnowledgeBaseOptions`),菜单只负责渲染 —— 笔记列表里每一行都包着这个
 * 菜单,状态不能放在菜单自己身上,不然每行各拉一次接口。
 *
 * 列表是懒加载的:菜单打开时才拉第一页,之后走缓存。列表底下有「加载更多」
 * —— 翻页是追加式的,点一下补一页,点完菜单不收,新条目直接补在下面。
 *
 * 「创建副本」「独立窗口打开」还没有对应的后端接口,先渲染成禁用项把菜单骨架
 * 立住 —— 接口到位后去掉 `disabled` 即可。
 */
import { AppIcon, cx } from '@aionui/ui';
import { Button, Dropdown, Menu } from '@arco-design/web-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { KnowledgeBaseOption } from '../api/knowledgeBases';
import type { NoteItem, Notebook } from '../api/types';
import type { KnowledgeBaseMenuState } from '../hooks/useKnowledgeBaseOptions';
import styles from './NoteContextMenu.module.css';

/** 「移动到笔记本」二级菜单里,笔记本项的 key 前缀。 */
const NOTEBOOK_KEY_PREFIX = 'notebook:';

/** 「添加到知识库」二级菜单里,知识库项的 key 前缀。 */
const KNOWLEDGE_BASE_KEY_PREFIX = 'knowledgeBase:';

export type NoteContextMenuProps = {
  /** 被操作的那条笔记。 */
  note: NoteItem;
  /** 全部笔记本 —— 二级菜单按它列出具体的分组名。 */
  notebooks: Notebook[];
  /** 触发区:整行(右键)。行尾「⋯」在行内,它的点击会冒泡到这里。 */
  children: React.ReactNode;
  /** 删除这条笔记。 */
  onDelete: () => void;
  /** 把这条笔记移动到指定笔记本。 */
  onMoveToNotebook: (notebookId: string) => void;
  /** 「新建笔记本」—— 由上层弹命名框,菜单只负责把意图抛出去。 */
  onCreateNotebook: () => void;
  /** 收藏 / 取消收藏。 */
  onToggleStar?: () => void;
  /** 重命名(行内编辑)。 */
  onRename?: () => void;
  /** 「添加到知识库」下拉里的知识库列表(页级状态,菜单只渲染)。 */
  knowledgeBaseMenu?: KnowledgeBaseMenuState;
  /** 菜单打开时触发:没拉过就拉第一页知识库。 */
  onRequestKnowledgeBases?: () => void;
  /** 选中一个知识库。 */
  onAddToKnowledgeBase?: (knowledgeBase: KnowledgeBaseOption) => void;
};

/** 菜单项的一行:左图标 + 文案 + 可选的尾部标记(勾)。 */
type MenuRowProps = {
  icon: React.ReactNode;
  label: React.ReactNode;
  trailing?: React.ReactNode;
};

const MenuRow: React.FC<MenuRowProps> = ({ icon, label, trailing }) => (
  <span className={styles.row}>
    <span className={styles.rowIcon}>{icon}</span>
    <span className={styles.rowLabel}>{label}</span>
    {trailing ? <span className={styles.rowTrailing}>{trailing}</span> : null}
  </span>
);

/**
 * 「加载更多」按钮。
 *
 * 刻意**不是** `Menu.Item`:菜单项被点一下就会收起菜单(二级菜单更是直接收起),
 * 而「加载更多」点完还得让人接着看新加载出来的条目 —— 塞一个普通元素进菜单,
 * 点击就不走菜单项那条路,菜单不收,新条目直接补在下面。
 *
 * 外面包一层组件(而不是直接放 `Button`):Arco 渲染菜单子节点时会往下传 `level`
 * 这类内部属性,自定义组件收下不用管,`Button` 直接吃下去会变成 DOM 上的
 * `level` 属性。
 */
const MenuLoadMore: React.FC<{ label: string; loading: boolean; onClick?: () => void }> = ({
  label,
  loading,
  onClick,
}) => (
  <Button
    type='text'
    size='mini'
    loading={loading}
    onClick={onClick}
    className={styles.loadMoreButton}
    data-testid='notes-kb-load-more'
  >
    {label}
  </Button>
);

const NoteContextMenu: React.FC<NoteContextMenuProps> = ({
  note,
  notebooks,
  children,
  onDelete,
  onMoveToNotebook,
  onCreateNotebook,
  onToggleStar,
  onRename,
  knowledgeBaseMenu,
  onRequestKnowledgeBases,
  onAddToKnowledgeBase,
}) => {
  const { t } = useTranslation();

  const personalKnowledgeBases = knowledgeBaseMenu?.personalItems ?? [];
  const sharedKnowledgeBases = knowledgeBaseMenu?.sharedItems ?? [];
  const knowledgeBaseLoading = knowledgeBaseMenu?.loading ?? false;
  const knowledgeBaseError = knowledgeBaseMenu?.error ?? null;
  const knowledgeBaseHasMore = knowledgeBaseMenu?.hasMore ?? false;

  const handleSelect = useCallback(
    (key: string) => {
      if (key === 'delete') {
        onDelete();
        return;
      }
      if (key === 'createNotebook') {
        onCreateNotebook();
        return;
      }
      if (key === 'star') {
        onToggleStar?.();
        return;
      }
      if (key === 'rename') {
        onRename?.();
        return;
      }
      if (key.startsWith(KNOWLEDGE_BASE_KEY_PREFIX)) {
        const id = key.slice(KNOWLEDGE_BASE_KEY_PREFIX.length);
        const target = [...personalKnowledgeBases, ...sharedKnowledgeBases].find((item) => item.id === id);
        if (target) onAddToKnowledgeBase?.(target);
        return;
      }
      if (!key.startsWith(NOTEBOOK_KEY_PREFIX)) return;
      const notebookId = key.slice(NOTEBOOK_KEY_PREFIX.length);
      // 已经在当前分组里 —— 什么都不做,也不必再请求一次后端。
      if (!notebookId || notebookId === note.notebookId) return;
      onMoveToNotebook(notebookId);
    },
    [
      note.notebookId,
      onAddToKnowledgeBase,
      onCreateNotebook,
      onDelete,
      onMoveToNotebook,
      onRename,
      onToggleStar,
      personalKnowledgeBases,
      sharedKnowledgeBases,
    ]
  );

  /** 「添加到知识库」二级菜单的内容:分组列出知识库,底下是「加载更多」。 */
  const renderKnowledgeBases = (): React.ReactNode => {
    const knowledgeBaseItem = (item: KnowledgeBaseOption) => (
      <Menu.Item key={`${KNOWLEDGE_BASE_KEY_PREFIX}${item.id}`} className={styles.item}>
        <MenuRow icon={<AppIcon name='knowledge-base' size={16} />} label={item.name} />
      </Menu.Item>
    );

    const hasAny = personalKnowledgeBases.length > 0 || sharedKnowledgeBases.length > 0;

    if (!hasAny && knowledgeBaseLoading) {
      return [
        <Menu.Item key='knowledgeBaseLoading' disabled className={styles.hint}>
          <span className={styles.hintText}>
            {t('settings.notesContextMenuKnowledgeBaseLoading', { defaultValue: 'Loading…' })}
          </span>
        </Menu.Item>,
      ];
    }
    if (!hasAny && knowledgeBaseError) {
      return [
        <Menu.Item key='knowledgeBaseError' disabled className={styles.hint}>
          <span className={styles.hintText}>
            {t('settings.notesContextMenuKnowledgeBaseError', { defaultValue: 'Failed to load' })}
          </span>
        </Menu.Item>,
      ];
    }
    if (!hasAny) {
      return [
        <Menu.Item key='addToKnowledgeBaseEmpty' disabled className={styles.hint}>
          <span className={styles.hintText}>
            {t('settings.notesContextMenuKnowledgeBaseEmpty', { defaultValue: 'No knowledge base available' })}
          </span>
        </Menu.Item>,
      ];
    }

    return [
      personalKnowledgeBases.length > 0 ? (
        <Menu.ItemGroup
          key='knowledgeBasePersonalGroup'
          /*
           * `notes-kb-group` 是给样式用的标记类:菜单里只有这个二级菜单有分组,
           * 样式表靠它把「知识库列表」这个下拉的高度上限单独放开(见 module.css)。
           * 刻意不用 CSS Module 的哈希类 —— `:has()` 要按字面类名匹配。
           */
          className='notes-kb-group'
          title={t('settings.knowledgeBaseTabPersonal', { defaultValue: 'Personal knowledge bases' })}
        >
          {personalKnowledgeBases.map(knowledgeBaseItem)}
        </Menu.ItemGroup>
      ) : null,
      sharedKnowledgeBases.length > 0 ? (
        <Menu.ItemGroup
          key='knowledgeBaseSharedGroup'
          className='notes-kb-group'
          title={t('settings.knowledgeBaseTabShared', { defaultValue: 'Shared knowledge bases' })}
        >
          {sharedKnowledgeBases.map(knowledgeBaseItem)}
        </Menu.ItemGroup>
      ) : null,
      knowledgeBaseHasMore ? (
        <div key='knowledgeBaseLoadMore' className={styles.loadMore}>
          <MenuLoadMore
            label={t('settings.notesContextMenuKnowledgeBaseLoadMore', { defaultValue: 'Load more' })}
            loading={knowledgeBaseLoading}
            onClick={knowledgeBaseMenu?.loadMore}
          />
        </div>
      ) : null,
    ];
  };

  const droplist = (
    <Menu className={styles.menu} onClickMenuItem={handleSelect}>
      <Menu.SubMenu
        key='addToKnowledgeBase'
        title={
          <MenuRow
            icon={<AppIcon name='knowledge-base' size={16} />}
            label={t('settings.notesContextMenuAddToKnowledgeBase', { defaultValue: 'Add to knowledge base' })}
          />
        }
      >
        {renderKnowledgeBases()}
      </Menu.SubMenu>

      <Menu.SubMenu
        key='moveToNotebook'
        title={
          <MenuRow
            icon={<AppIcon name='folder-open' size={16} />}
            label={t('settings.notesContextMenuMoveToNotebook', { defaultValue: 'Move to group' })}
          />
        }
      >
        <Menu.Item key='createNotebook' className={styles.item}>
          <MenuRow
            icon={<AppIcon name='plus' size={16} />}
            label={t('settings.notesCreateNotebook', { defaultValue: 'New group' })}
          />
        </Menu.Item>
        {notebooks.length > 0 ? <Menu.Item key='divider-notebooks' disabled className={styles.divider} /> : null}
        {notebooks.map((notebook) => (
          <Menu.Item key={`${NOTEBOOK_KEY_PREFIX}${notebook.id}`} className={styles.item}>
            <MenuRow
              icon={<AppIcon name='book-one' size={16} />}
              label={notebook.name}
              trailing={notebook.id === note.notebookId ? <AppIcon name='check' size={16} /> : null}
            />
          </Menu.Item>
        ))}
      </Menu.SubMenu>

      <Menu.Item key='divider-actions' disabled className={styles.divider} />

      <Menu.Item key='star' className={styles.item}>
        <MenuRow
          icon={<AppIcon name='star' size={16} />}
          label={
            note.star
              ? t('settings.notesUnstar', { defaultValue: 'Remove from favorites' })
              : t('settings.notesStar', { defaultValue: 'Favorite' })
          }
        />
      </Menu.Item>

      <Menu.Item key='rename' className={styles.item}>
        <MenuRow
          icon={<AppIcon name='file-text' size={16} />}
          label={t('settings.notesRename', { defaultValue: 'Rename' })}
        />
      </Menu.Item>

      <Menu.Item key='duplicate' disabled className={styles.item}>
        <MenuRow
          icon={<AppIcon name='copy' size={16} />}
          label={t('settings.notesContextMenuDuplicate', { defaultValue: 'Create a copy' })}
        />
      </Menu.Item>

      <Menu.Item key='openInNewWindow' disabled className={styles.item}>
        <MenuRow
          icon={<AppIcon name='extend' size={16} />}
          label={t('settings.notesContextMenuOpenInNewWindow', { defaultValue: 'Open in new window' })}
        />
      </Menu.Item>

      <Menu.Item key='divider-delete' disabled className={styles.divider} />

      <Menu.Item key='delete' className={cx(styles.item, styles.danger)}>
        <MenuRow
          icon={<AppIcon name='delete' size={16} />}
          label={t('settings.notesContextMenuDelete', { defaultValue: 'Delete' })}
        />
      </Menu.Item>
    </Menu>
  );

  return (
    <Dropdown
      trigger={['contextMenu', 'click']}
      position='bl'
      droplist={droplist}
      getPopupContainer={() => document.body}
      /*
       * `Dropdown` 只在 `trigger === 'contextMenu'` 时默认贴着光标弹;触发方式改成
       * 数组后要自己打开,否则「⋯」的菜单会落在整行的右下角,离按钮很远。
       * `bl` = 菜单左上角对齐光标 —— 右键时向右下展开,点「⋯」时从按钮处展开。
       * Arco 的 `escToClose` 默认关着,右键菜单要能按 ESC 收掉。
       */
      triggerProps={{ alignPoint: true, escToClose: true }}
      /*
       * 菜单打开时才去拉知识库列表 —— 列表是懒加载的(笔记列表里每一行都包着
       * 这个菜单,不能一挂载就发请求)。
       */
      onVisibleChange={(visible) => {
        if (visible) onRequestKnowledgeBases?.();
      }}
      data-testid='notes-context-menu'
    >
      {children}
    </Dropdown>
  );
};

export default NoteContextMenu;
