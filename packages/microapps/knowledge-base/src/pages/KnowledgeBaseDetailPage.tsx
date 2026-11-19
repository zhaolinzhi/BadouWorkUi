/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 知识库详情页（设计稿 `kb-content` 视图）—— 列出该知识库下的文档。
 *
 * 结构：顶部导航（返回 / 更多 / 问知识库）→ 标题区（封面 + 库名 + 副标题）
 * → 工具行（内容计数 + 搜索）→ 文档行列表 → 底部（加载更多 / 没有更多内容了）。
 */

import type { KnowledgeBaseRuntime } from './KnowledgeBaseRoutes';
import DocumentFileIcon, { FILE_FOLDER_ICON } from '../components/kb/DocumentFileIcon';
import KnowledgeBaseUploadModal from '../components/kb/KnowledgeBaseUploadModal';
import AddMaterialIcon from '../assets/svgs/file-add.svg?component';
import SortIcon from '../assets/svgs/file-sort.svg?component';
import { useKnowledgeBaseDocuments } from '../hooks/useKnowledgeBaseDocuments';
import { useKnowledgeBaseUpload } from '../hooks/useKnowledgeBaseUpload';
import { interpolateI18n } from '../utils/knowledgeBaseUtils';
import KnowledgeBaseAvatar from '../components/KnowledgeBaseAvatar';
import { AppIcon, AsyncBoundary, EmptyState, MoreMenu } from '@aionui/ui';
import { Button, Input, Message } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppRuntime } from '../AppContext';
import styles from './KnowledgeBaseDetailPage.module.css';

export type KnowledgeBaseDetailPageProps = {
  /** 页面级共享状态与回调，由路由层从 Context 取。 */
  runtime: KnowledgeBaseRuntime;
};

/**
 * 文档更新时间截到分钟显示（设计稿形如 `2025-08-29 12:18`）。
 *
 * 数据层保留接口原样字符串（`2026-11-17 15:09:47.0`），只在视图层格式化；
 * 兼容后端将来改成带 `T` 的 ISO 形式（`2026-11-17T15:09:47`）。
 */
const formatUpdatedAt = (value: string): string => value.replace('T', ' ').slice(0, 16);

const KnowledgeBaseDetailPage: React.FC<KnowledgeBaseDetailPageProps> = ({ runtime }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // shell 路由跳转（跨进程，去「问知识库」页）；微应用内返回用上面的 react-router navigate。
  const { navigate: shellNavigate } = useAppRuntime();
  const { knowledgeBaseId } = useParams<{ knowledgeBaseId: string }>();
  const [searching, setSearching] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [messageApi, messageContext] = Message.useMessage({ maxCount: 10 });
  const message = messageApi as Required<typeof messageApi>;
  const {
    documents,
    total,
    loading,
    error,
    keyword,
    activeKeyword,
    setKeyword,
    loadMore,
    hasMore,
    reload,
    refresh,
    sortOrder,
    toggleSortOrder,
  } = useKnowledgeBaseDocuments(knowledgeBaseId);

  /*
   * 收起搜索 —— 清空搜索词并关掉搜索框。
   *
   * 对应设计稿的「清除搜索」按钮（`clear-search`：清空 + 收起）。
   * 只清词不收起的话，搜索框会一直占着工具行的位置，用户没法回到普通视图。
   */
  const closeSearch = useCallback(() => {
    setKeyword('');
    setSearching(false);
  }, [setKeyword]);

  const sortLabel =
    sortOrder === 'desc'
      ? t('settings.knowledgeBaseDetailSortDesc', { defaultValue: '按创建时间排序（最新在前）' })
      : t('settings.knowledgeBaseDetailSortAsc', { defaultValue: '按创建时间排序（最早在前）' });

  /*
   * 「添加资料」菜单 —— 菜单项按设计稿来（上传文件 / 新建文本）。
   *
   * 这两个动作后端还没给接口（文档是随知识库一起保存的），所以先置灰 ——
   * 接口到位后把 `disabled` 去掉即可。
   */
  const knowledgeBase = useMemo(
    () => [...runtime.personalItems, ...runtime.sharedItems].find((item) => item.id === knowledgeBaseId) ?? null,
    [runtime.personalItems, runtime.sharedItems, knowledgeBaseId]
  );

  /*
   * 上传文档 —— 工具行的「添加资料」按钮直接打开上传弹窗。
   *
   * 上传成功后关弹窗并回到第 1 页刷新（新文档按创建时间倒序排在最前面，
   * 回到第 1 页才看得见）。
   */
  const handleUploadSuccess = useCallback(() => {
    setUploadVisible(false);
    refresh();
    message.success(t('settings.knowledgeBaseUploadSuccess', { defaultValue: '文件已上传，正在处理' }));
  }, [message, refresh, t]);

  const {
    files: uploadFiles,
    addFiles: addUploadFiles,
    removeFile: removeUploadFile,
    reset: resetUpload,
    submit: submitUpload,
    uploading: uploadUploading,
    error: uploadError,
  } = useKnowledgeBaseUpload({ knowledgeBaseId, onSuccess: handleUploadSuccess });

  /** 打开上传弹窗 —— 每次都从干净的待传列表开始。 */
  const openUpload = useCallback(() => {
    resetUpload();
    setUploadVisible(true);
  }, [resetUpload]);

  /*
   * 当前知识库从列表里消失 = 被删除了 —— 回首页。
   *
   * ref 记住「曾经见过的库 id」：只有见过同一个 id 之后它又消失，才算删除。
   * 存 id 而不是布尔 —— 组件不重挂载、参数从 /kb/A 变成不存在的 /kb/B 时,
   * 「见过 A」不能拿来判定「B 被删除」。首次进入时列表还没加载完
   * （`knowledgeBase` 为 null）也不能误判。
   */
  const seenKnowledgeBaseId = useRef<string | null>(null);
  useEffect(() => {
    if (knowledgeBase) {
      seenKnowledgeBaseId.current = knowledgeBaseId ?? null;
      return;
    }
    if (seenKnowledgeBaseId.current !== null && seenKnowledgeBaseId.current === knowledgeBaseId) {
      navigate('/', { replace: true });
    }
  }, [knowledgeBase, knowledgeBaseId, navigate]);

  const scopeText = knowledgeBase?.isShared
    ? `${t('settings.knowledgeBaseTabShared', { defaultValue: '共享知识库' })} · ${t(
        'settings.knowledgeBaseTeamShared',
        {
          defaultValue: '团队共享',
        }
      )}`
    : `${t('settings.knowledgeBaseTabPersonal', { defaultValue: '个人知识库' })} · ${t(
        'settings.knowledgeBasePrivateOnly',
        {
          defaultValue: '仅自己可见',
        }
      )}`;

  const title =
    knowledgeBase?.name ??
    (runtime.listLoaded ? t('settings.knowledgeBaseDetailMissing', { defaultValue: '知识库不存在或已被删除' }) : '');

  // 「更多」菜单只给个人库：共享库不允许在详情页编辑 / 删除。
  const moreItems = useMemo(() => {
    if (!knowledgeBase || knowledgeBase.isShared) return [];
    return [
      {
        key: 'edit',
        label: t('common.edit', { defaultValue: '编辑' }),
        testId: 'kb-detail-more-edit',
      },
      {
        key: 'delete',
        label: t('common.delete', { defaultValue: '删除' }),
        icon: <AppIcon name='delete' size={14} />,
        danger: true,
        testId: 'kb-detail-more-delete',
      },
    ];
  }, [knowledgeBase, t]);

  /*
   * 文档行的「更多」菜单 —— 菜单项按设计稿来（重命名 / 删除）。
   *
   * 这两个动作后端还没给接口（文档是随知识库一起保存的，没有单文档的
   * 重命名 / 删除接口），所以先置灰 —— 接口到位后把 `disabled` 去掉、
   * 在 `handleDocumentAction` 里按 key 分发即可。
   */
  const documentMenuItems = useMemo(
    () => [
      {
        key: 'rename',
        label: t('settings.knowledgeBaseDocumentRename', { defaultValue: '重命名' }),
        disabled: true,
        testId: 'kb-document-menu-rename',
      },
      {
        key: 'delete',
        label: t('common.delete', { defaultValue: '删除' }),
        icon: <AppIcon name='delete' size={14} />,
        danger: true,
        disabled: true,
        testId: 'kb-document-menu-delete',
      },
    ],
    [t]
  );

  // 菜单项目前都是置灰的，走不到这里；接口到位后在这里按 key 分发动作。
  const handleDocumentAction = useCallback(() => undefined, []);

  return (
    <div className={styles.page} data-testid='kb-detail'>
      <div className={styles.nav}>
        <Button type='text' className={styles.back} onClick={() => navigate('/')} data-testid='kb-detail-back'>
          <AppIcon name='arrow-left' size={16} />
          {t('settings.knowledgeBaseDetailBack', { defaultValue: '知识库' })}
        </Button>
        <span className={styles.navSpacer} />
        {moreItems.length > 0 ? (
          <MoreMenu
            items={moreItems}
            label={t('settings.knowledgeBaseDetailMore', { defaultValue: '知识库更多操作' })}
            onSelect={(key) => {
              if (!knowledgeBase) return;
              if (key === 'edit') runtime.onOpenEdit(knowledgeBase);
              if (key === 'delete') runtime.onDelete(knowledgeBase);
            }}
            data-testid='kb-detail-more'
          />
        ) : null}
        <Button
          type='primary'
          className={styles.askButton}
          disabled={!knowledgeBase}
          onClick={() => shellNavigate(`/kb-chat/${encodeURIComponent(knowledgeBaseId ?? '')}`)}
          data-testid='kb-detail-ask'
        >
          {t('settings.knowledgeBaseDetailAsk', { defaultValue: '问知识库' })}
        </Button>
      </div>

      <div className={styles.content}>
        <div className={styles.heading}>
          {knowledgeBase ? (
            <KnowledgeBaseAvatar
              knowledgeBase={knowledgeBase}
              size={80}
              radius={16}
              iconScale={0.32}
              fallback={<img src={FILE_FOLDER_ICON} alt='' width={48} height={48} />}
            />
          ) : null}
          <div>
            <h1 className={styles.headingTitle} data-testid='kb-detail-title'>
              {title}
            </h1>
            <p className={styles.headingSubtitle} data-testid='kb-detail-subtitle'>
              {scopeText}
            </p>
          </div>
        </div>

        <div className={styles.toolbar}>
          <span className={styles.toolbarTitle} data-testid='kb-detail-count'>
            {activeKeyword
              ? t('settings.knowledgeBaseDetailSearchResults', { defaultValue: '搜索结果' })
              : t('settings.knowledgeBaseDetailContent', { defaultValue: '内容' })}{' '}
            ({total})
          </span>
          {searching ? (
            <div className={styles.search}>
              <AppIcon name='search' size={16} className={styles.searchIcon} />
              <Input
                value={keyword}
                onChange={setKeyword}
                placeholder={t('settings.knowledgeBaseDetailSearchPlaceholder', { defaultValue: '搜索文件' })}
                onKeyDown={(event) => {
                  // Esc 收起搜索 —— 与设计稿的「清除搜索」按钮同义。
                  if (event.key === 'Escape') closeSearch();
                }}
                data-testid='kb-detail-search'
              />
              <Button
                type='text'
                className={styles.searchClose}
                onClick={closeSearch}
                aria-label={t('settings.knowledgeBaseClearSearch', { defaultValue: '清除搜索' })}
                title={t('settings.knowledgeBaseClearSearch', { defaultValue: '清除搜索' })}
                data-testid='kb-detail-search-close'
              >
                <AppIcon name='close-small' size={14} />
              </Button>
            </div>
          ) : (
            <Button
              type='text'
              className={styles.iconButton}
              onClick={() => setSearching(true)}
              aria-label={t('settings.knowledgeBaseDetailSearchPlaceholder', { defaultValue: '搜索文件' })}
              data-testid='kb-detail-search-toggle'
            >
              <AppIcon name='search' size={16} />
            </Button>
          )}
          <Button
            type='text'
            className={styles.iconButton}
            onClick={toggleSortOrder}
            aria-label={sortLabel}
            title={sortLabel}
            data-testid='kb-detail-sort'
          >
            <SortIcon size={18} />
          </Button>
          <Button
            type='text'
            className={styles.iconButton}
            onClick={openUpload}
            aria-label={t('settings.knowledgeBaseDetailAddMaterial', { defaultValue: '添加资料' })}
            title={t('settings.knowledgeBaseDetailAddMaterial', { defaultValue: '添加资料' })}
            data-testid='kb-detail-add-material'
          >
            <AddMaterialIcon size={18} />
          </Button>
        </div>

        <AsyncBoundary
          loading={loading && documents.length === 0}
          error={error}
          onRetry={reload}
          retryText={t('common.retry', { defaultValue: '重试' })}
          errorContent={
            <span data-testid='kb-detail-error'>
              {t('settings.knowledgeBaseDetailLoadFailed', { defaultValue: '加载文档失败' })}
            </span>
          }
          loadingContent={
            <div className={styles.loading} data-testid='kb-detail-loading'>
              {t('settings.knowledgeBaseDetailLoading', { defaultValue: '正在加载文档…' })}
            </div>
          }
          isEmpty={documents.length === 0}
          emptyContent={
            <EmptyState
              icon={<AppIcon name='file-text' size={40} />}
              title={
                activeKeyword
                  ? t('settings.knowledgeBaseDetailNoResultsTitle', { defaultValue: '暂无搜索结果' })
                  : t('settings.knowledgeBaseDetailEmptyTitle', { defaultValue: '这个知识库还没有文档' })
              }
              description={
                activeKeyword
                  ? t('settings.knowledgeBaseNoResultsBody', { defaultValue: '试试其他关键词，或清除搜索。' })
                  : t('settings.knowledgeBaseDetailEmptyBody', {
                      defaultValue: '上传文档后，即可在这里集中管理和使用知识。',
                    })
              }
              action={
                activeKeyword ? undefined : (
                  <Button type='primary' onClick={openUpload} data-testid='kb-detail-empty-upload'>
                    {t('settings.knowledgeBaseDetailUploadFile', { defaultValue: '上传文件' })}
                  </Button>
                )
              }
            />
          }
        >
          <div data-testid='kb-document-list'>
            {documents.map((doc) => (
              <div key={doc.id} className={styles.row} data-testid={`kb-document-${doc.id}`}>
                <span className={styles.rowName}>
                  <DocumentFileIcon name={doc.name} type={doc.type} size={28} className={styles.rowIcon} />
                  <span className={styles.rowNameText}>{doc.name}</span>
                </span>
                <span className={styles.rowMeta}>{doc.type}</span>
                <span className={styles.rowMeta}>
                  {interpolateI18n(
                    t('settings.knowledgeBaseDetailRecords', { count: doc.records, defaultValue: '{{count}} 条数据' }),
                    { count: doc.records }
                  )}
                </span>
                <span className={styles.rowDate}>{formatUpdatedAt(doc.updatedAt)}</span>
                <span className={styles.rowCreated}>{doc.createdAt}</span>
                <MoreMenu
                  items={documentMenuItems}
                  label={`${doc.name} ${t('settings.knowledgeBaseDocumentMore', { defaultValue: '更多操作' })}`}
                  onSelect={handleDocumentAction}
                  className={styles.rowMore}
                  data-testid={`kb-document-more-${doc.id}`}
                />
              </div>
            ))}
          </div>
        </AsyncBoundary>

        {documents.length > 0 ? (
          hasMore ? (
            <div className={styles.footer}>
              <Button
                type='secondary'
                className={styles.loadMore}
                loading={loading}
                onClick={loadMore}
                data-testid='kb-detail-load-more'
              >
                {t('settings.knowledgeBaseDetailLoadMore', { defaultValue: '加载更多' })}
                <span className={styles.loadMoreHint}>
                  {interpolateI18n(
                    t('settings.knowledgeBaseDetailLoadMoreHint', {
                      loaded: documents.length,
                      total,
                      defaultValue: '已加载 {{loaded}} / 共 {{total}}',
                    }),
                    { loaded: documents.length, total }
                  )}
                </span>
              </Button>
            </div>
          ) : (
            <div className={styles.end} data-testid='kb-detail-end'>
              {t('settings.knowledgeBaseDetailNoMore', { defaultValue: '没有更多内容了' })}
            </div>
          )
        ) : null}
      </div>

      <KnowledgeBaseUploadModal
        visible={uploadVisible}
        onCancel={() => setUploadVisible(false)}
        knowledgeBaseName={knowledgeBase?.name ?? ''}
        files={uploadFiles}
        onAddFiles={addUploadFiles}
        onRemoveFile={removeUploadFile}
        onSubmit={submitUpload}
        uploading={uploadUploading}
        error={uploadError}
      />

      {messageContext}
    </div>
  );
};

export default KnowledgeBaseDetailPage;
