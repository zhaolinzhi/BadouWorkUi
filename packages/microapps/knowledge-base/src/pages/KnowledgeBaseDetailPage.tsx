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
import type { KnowledgeBaseDocument } from '../types';
import DocumentFileIcon, { FILE_FOLDER_ICON } from '../components/kb/DocumentFileIcon';
import KnowledgeBaseQueuePanel from '../components/kb/KnowledgeBaseQueuePanel';
import KnowledgeBaseUploadModal from '../components/kb/KnowledgeBaseUploadModal';
import KnowledgeBaseTextModal from '../components/kb/KnowledgeBaseTextModal';
import AddMaterialIcon from '../assets/svgs/file-add.svg?component';
import QueueIcon from '../assets/svgs/file-queue.svg?component';
import ReparseIcon from '../assets/svgs/file-reparse.svg?component';
import SortAscIcon from '../assets/svgs/file-sort-asc.svg?component';
import SortDescIcon from '../assets/svgs/file-sort-desc.svg?component';
import { useKnowledgeBaseDocuments } from '../hooks/useKnowledgeBaseDocuments';
import { useKnowledgeBaseDocumentDelete } from '../hooks/useKnowledgeBaseDocumentDelete';
import { useKnowledgeBaseDocumentReparse } from '../hooks/useKnowledgeBaseDocumentReparse';
import { useKnowledgeBaseUpload } from '../hooks/useKnowledgeBaseUpload';
import type { KnowledgeBaseUploadFile } from '../hooks/useKnowledgeBaseUpload';
import { interpolateI18n } from '../utils/knowledgeBaseUtils';
import KnowledgeBaseAvatar from '../components/KnowledgeBaseAvatar';
import { AppIcon, AsyncBoundary, ConfirmModal, EmptyState, MoreMenu } from '@aionui/ui';
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
    pollRefresh,
    pollUntilTotalGrows,
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
   * 文件处理队列 —— 直接用文档列表接口返回的 `progress`。
   *
   * 后端解析进度时会更新它，100 即处理完成；队列面板据此显示每个文件的
   * 状态与百分比。
   */
  const [queueVisible, setQueueVisible] = useState(false);
  /** 「清空已完成」之后只留处理中的。 */
  const [queueOnlyProcessing, setQueueOnlyProcessing] = useState(false);

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
   * 上传成功后关弹窗、登记到文件处理队列，并**轮询**列表直到新文档出现：
   * 上传接口是异步处理的，返回时文档还没进列表，只刷新一次的话用户会以为
   * 「上传了但没生效」。
   */
  const handleUploadSuccess = useCallback(
    (_uploaded: KnowledgeBaseUploadFile[]) => {
      setUploadVisible(false);
      message.success(t('settings.knowledgeBaseUploadSuccess', { defaultValue: '文件已上传，正在处理' }));
      void pollUntilTotalGrows();
    },
    [message, pollUntilTotalGrows, t]
  );

  const {
    files: uploadFiles,
    addFiles: addUploadFiles,
    removeFile: removeUploadFile,
    reset: resetUpload,
    submit: submitUpload,
    uploadFiles: uploadFilesDirectly,
    uploading: uploadUploading,
    error: uploadError,
  } = useKnowledgeBaseUpload({ knowledgeBaseId, onSuccess: handleUploadSuccess });

  /** 打开上传弹窗 —— 每次都从干净的待传列表开始。 */
  const openUpload = useCallback(() => {
    resetUpload();
    setUploadVisible(true);
  }, [resetUpload]);

  /*
   * 新建文本 —— 把正文存成知识库里的一个 `.txt` 文件，走同一条上传接口。
   *
   * 跟「上传文件」的区别只是文件是现造的：没有文件选择器，直接把文本
   * 装进一个 File 里发出去。
   */
  const [textVisible, setTextVisible] = useState(false);

  const openText = useCallback(() => {
    setTextVisible(true);
  }, []);

  const handleTextSubmit = useCallback(
    async (values: { name: string; text: string }): Promise<boolean> => {
      // 文件名没带扩展名就补 `.txt` —— 后端按文件名判类型。
      const fileName = /\.[a-z0-9]+$/i.test(values.name) ? values.name : `${values.name}.txt`;
      const file = new File([values.text], fileName, { type: 'text/plain' });
      const succeeded = await uploadFilesDirectly([{ uid: 'text', name: fileName, file }]);
      if (succeeded) setTextVisible(false);
      return succeeded;
    },
    [uploadFilesDirectly]
  );

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

  /*
   * 导航上的「更多」菜单 —— 设计稿的 `library-more`：
   * 上传文件 / 新建文本 / 文件处理队列。
   */
  const moreItems = useMemo(
    () => [
      {
        key: 'upload',
        label: t('settings.knowledgeBaseDetailUploadFile', { defaultValue: '上传文件' }),
        icon: <AppIcon name='upload' size={14} />,
        testId: 'kb-detail-more-upload',
      },
      {
        key: 'text',
        label: t('settings.knowledgeBaseDetailNewText', { defaultValue: '新建文本' }),
        icon: <AppIcon name='notes' size={14} />,
        testId: 'kb-detail-more-text',
      },
      {
        key: 'queue',
        label: t('settings.knowledgeBaseQueueMenu', { defaultValue: '文件处理队列' }),
        icon: <QueueIcon size={14} />,
        testId: 'kb-detail-more-queue',
      },
    ],
    [t]
  );

  const handleMoreAction = useCallback(
    (key: string) => {
      if (key === 'upload') openUpload();
      if (key === 'text') openText();
      if (key === 'queue') {
        // 没有文件时不打开面板 —— 直接提示（设计稿的行为）。
        if (documents.length === 0) {
          message.info(t('settings.knowledgeBaseQueueEmpty', { defaultValue: '暂无文件处理任务' }));
          return;
        }
        setQueueVisible(true);
      }
    },
    [documents.length, message, openText, openUpload, t]
  );

  /*
   * 「添加资料」菜单 —— 上传文件 / 新建文本（设计稿的 `.kb-popup`）。
   *
   * 两条路都落到同一个上传接口：上传文件是选本地文件，新建文本是把正文
   * 存成 `.txt` 再传。
   */
  const addMaterialItems = useMemo(
    () => [
      {
        key: 'upload',
        label: t('settings.knowledgeBaseDetailUploadFile', { defaultValue: '上传文件' }),
        icon: <AppIcon name='upload' size={14} />,
        testId: 'kb-detail-add-menu-upload',
      },
      {
        key: 'text',
        label: t('settings.knowledgeBaseDetailNewText', { defaultValue: '新建文本' }),
        icon: <AppIcon name='notes' size={14} />,
        testId: 'kb-detail-add-menu-text',
      },
    ],
    [t]
  );

  const handleAddMaterial = useCallback(
    (key: string) => {
      if (key === 'upload') openUpload();
      if (key === 'text') openText();
    },
    [openText, openUpload]
  );

  /*
   * 文档行的「更多」菜单 —— 菜单项按设计稿来（重新解析 / 删除）。
   *
   * 两个动作都有接口了：重新解析走 `reParseKnowledges.do`，删除走
   * `cancelUsingKnowledge.do`，点开都是二次确认。
   */
  const documentMenuItems = useMemo(
    () => [
      {
        key: 'reparse',
        label: t('settings.knowledgeBaseDocumentReparse', { defaultValue: '重新解析' }),
        icon: <ReparseIcon size={14} />,
        testId: 'kb-document-menu-reparse',
      },
      {
        key: 'delete',
        label: t('common.delete', { defaultValue: '删除' }),
        icon: <AppIcon name='delete' size={14} />,
        danger: true,
        testId: 'kb-document-menu-delete',
      },
    ],
    [t]
  );

  /* 删除：先记住要删哪个文档，确认弹窗里再发请求。 */
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBaseDocument | null>(null);

  const handleDeleteSuccess = useCallback(() => {
    setDeleteTarget(null);
    message.success(t('settings.knowledgeBaseDocumentDeleteSuccess', { defaultValue: '文件已删除' }));
    // 文档没了，总数会变小 —— 拉一次第 1 页。
    void refresh();
  }, [message, refresh, t]);

  const documentDelete = useKnowledgeBaseDocumentDelete({
    knowledgeBaseId,
    onSuccess: handleDeleteSuccess,
  });

  /* 重新解析：同样先记住目标文档，确认后再发请求。 */
  const [reparseTarget, setReparseTarget] = useState<KnowledgeBaseDocument | null>(null);

  const handleReparseSuccess = useCallback(() => {
    setReparseTarget(null);
    message.success(t('settings.knowledgeBaseDocumentReparseSuccess', { defaultValue: '已重新解析' }));
    // 重新解析在后台跑，「N 条数据」过一会儿才更新 —— 轮询几次列表。
    void pollRefresh();
  }, [message, pollRefresh, t]);

  const documentReparse = useKnowledgeBaseDocumentReparse({
    knowledgeBaseId,
    onSuccess: handleReparseSuccess,
  });

  const handleDocumentAction = useCallback((key: string, doc: KnowledgeBaseDocument) => {
    if (key === 'delete') setDeleteTarget(doc);
    if (key === 'reparse') setReparseTarget(doc);
  }, []);

  return (
    <div className={styles.page} data-testid='kb-detail'>
      <div className={styles.nav}>
        <Button type='text' className={styles.back} onClick={() => navigate('/')} data-testid='kb-detail-back'>
          <AppIcon name='arrow-left' size={16} />
          {t('settings.knowledgeBaseDetailBack', { defaultValue: '知识库' })}
        </Button>
        <span className={styles.navSpacer} />
        <MoreMenu
          items={moreItems}
          label={t('settings.knowledgeBaseDetailMore', { defaultValue: '知识库更多操作' })}
          onSelect={handleMoreAction}
          data-testid='kb-detail-more'
        />
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
            {/* 图标随排序方向变化：降序（最新在前）用降序图标，升序反之。 */}
            {sortOrder === 'desc' ? <SortDescIcon size={18} /> : <SortAscIcon size={18} />}
          </Button>
          <MoreMenu
            items={addMaterialItems}
            label={t('settings.knowledgeBaseDetailAddMaterial', { defaultValue: '添加资料' })}
            onSelect={handleAddMaterial}
            icon={<AddMaterialIcon size={18} />}
            className={styles.iconButton}
            data-testid='kb-detail-add-material'
          />
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
                  onSelect={(key) => handleDocumentAction(key, doc)}
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

      {/* 文件处理队列 —— 进度来自文档列表接口的 progress 字段 */}
      <KnowledgeBaseQueuePanel
        visible={queueVisible}
        documents={documents}
        onlyProcessing={queueOnlyProcessing}
        onClose={() => setQueueVisible(false)}
        onClearDone={() => setQueueOnlyProcessing(true)}
      />

      {/* 新建文本 —— 正文存成 .txt 走同一条上传接口 */}
      <KnowledgeBaseTextModal
        visible={textVisible}
        onCancel={() => setTextVisible(false)}
        onSubmit={handleTextSubmit}
        submitting={uploadUploading}
        error={uploadError}
      />

      {/* 重新解析文档的二次确认 */}
      <ConfirmModal
        visible={reparseTarget !== null}
        className={styles.deleteConfirm}
        title={t('settings.knowledgeBaseDocumentReparse', { defaultValue: '重新解析' })}
        description={t('settings.knowledgeBaseDocumentReparseConfirm', {
          defaultValue: '是否确认对所选文件进行重新解析',
        })}
        okText={t('settings.knowledgeBaseDocumentReparse', { defaultValue: '重新解析' })}
        cancelText={t('common.cancel', { defaultValue: '取消' })}
        okLoading={documentReparse.reparsing}
        onCancel={() => setReparseTarget(null)}
        onOk={() => {
          if (reparseTarget) void documentReparse.reparse([reparseTarget.id]);
        }}
      >
        {reparseTarget ? (
          <div className={styles.deleteTarget}>
            <DocumentFileIcon name={reparseTarget.name} size={28} className={styles.deleteTargetIcon} />
            <span className={styles.deleteTargetName}>{reparseTarget.name}</span>
          </div>
        ) : null}
        {documentReparse.error ? (
          <div className={styles.deleteError} data-testid='kb-document-reparse-error'>
            {documentReparse.error}
          </div>
        ) : null}
      </ConfirmModal>

      {/* 删除文档的二次确认 */}
      <ConfirmModal
        visible={deleteTarget !== null}
        className={styles.deleteConfirm}
        title={t('settings.knowledgeBaseDocumentDeleteTitle', { defaultValue: '删除文件' })}
        description={t('settings.knowledgeBaseDocumentDeleteConfirm', {
          defaultValue: '是否确认删除所选文件及其生成的全部知识内容数据',
        })}
        okText={t('common.delete', { defaultValue: '删除' })}
        cancelText={t('common.cancel', { defaultValue: '取消' })}
        danger
        okLoading={documentDelete.deleting}
        onCancel={() => setDeleteTarget(null)}
        onOk={() => {
          if (deleteTarget) void documentDelete.remove(deleteTarget.id);
        }}
      >
        {deleteTarget ? (
          <div className={styles.deleteTarget}>
            <DocumentFileIcon name={deleteTarget.name} size={28} className={styles.deleteTargetIcon} />
            <span className={styles.deleteTargetName}>{deleteTarget.name}</span>
          </div>
        ) : null}
        {documentDelete.error ? (
          <div className={styles.deleteError} data-testid='kb-document-delete-error'>
            {documentDelete.error}
          </div>
        ) : null}
      </ConfirmModal>

      {messageContext}
    </div>
  );
};

export default KnowledgeBaseDetailPage;
