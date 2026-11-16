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
 * 当前是**静态版**:「添加到知识库」「创建副本」「独立窗口打开」还没有对应的
 * 后端接口,先渲染成禁用项把菜单骨架立住 —— 接口到位后去掉 `disabled` 即可。
 */
import { AppIcon, cx } from '@aionui/ui';
import { Dropdown, Menu } from '@arco-design/web-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { NoteItem, Notebook } from '../api/types';
import styles from './NoteContextMenu.module.css';

/** 「移动到笔记本」二级菜单里,笔记本项的 key 前缀。 */
const NOTEBOOK_KEY_PREFIX = 'notebook:';

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

const NoteContextMenu: React.FC<NoteContextMenuProps> = ({
  note,
  notebooks,
  children,
  onDelete,
  onMoveToNotebook,
  onCreateNotebook,
  onToggleStar,
  onRename,
}) => {
  const { t } = useTranslation();

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
      if (!key.startsWith(NOTEBOOK_KEY_PREFIX)) return;
      const notebookId = key.slice(NOTEBOOK_KEY_PREFIX.length);
      // 已经在当前分组里 —— 什么都不做,也不必再请求一次后端。
      if (!notebookId || notebookId === note.notebookId) return;
      onMoveToNotebook(notebookId);
    },
    [note.notebookId, onCreateNotebook, onDelete, onMoveToNotebook, onRename, onToggleStar]
  );

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
        <Menu.Item key='addToKnowledgeBaseEmpty' disabled className={styles.hint}>
          <span className={styles.hintText}>
            {t('settings.notesContextMenuKnowledgeBaseEmpty', { defaultValue: 'No knowledge base available' })}
          </span>
        </Menu.Item>
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
      data-testid='notes-context-menu'
    >
      {children}
    </Dropdown>
  );
};

export default NoteContextMenu;
