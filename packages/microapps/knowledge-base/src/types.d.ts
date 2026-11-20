/**
 * Ambient type declarations + shared domain types for the microapp build.
 *
 * Mirrors the desktop app's `packages/desktop/src/renderer/types.d.ts`
 * subset that this microapp needs (only CSS Modules — images/SVGs are not
 * used here). Required because `tsc --noEmit` runs on this package
 * independently and Vite-only `vite/client` references are not sufficient.
 *
 * The domain types live in the same file so `src/` keeps a flat layout —
 * the sibling microapps (`notes` / `meeting-recording`) use the same
 * single `types.d.ts` file for their ambient declarations.
 */
/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type KnowledgeBaseTab = 'personal' | 'shared';

// TODO: API - 对接后端接口后完善 KnowledgeBaseItem 类型
export type KnowledgeBaseItem = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  owner?: string;
  isShared: boolean;
  documentCount?: number;
  createdAt?: string;
  updatedAt?: string;
  /** Marks knowledge bases that come pre-bundled with the product. */
  source?: 'builtin' | 'user';
  /** Agent/runtime engine powering the knowledge base. */
  agentId?: string;
};

export type KnowledgeBaseListItem = KnowledgeBaseItem;

/**
 * 知识库里的文档（产品设计资料页的行）。
 * 字段来自 `view_knowledge_relevancy` 接口的 `Rows`。
 */
export type KnowledgeBaseDocument = {
  id: string;
  /** 文件名,如 `AppIcon.md` */
  name: string;
  /** 文件类型(已转大写),如 `MD`;接口未给时为空串 */
  type: string;
  /** 数据条数,来自 `processedTaskNum` */
  records: number;
  /** 更新时间,接口原样字符串 */
  updatedAt: string;
  /** 创建时间,接口原样字符串(一般只到天) */
  createdAt: string;
  /**
   * 解析进度（0~100），来自接口的 `progress` 字段。
   *
   * 接口未给时为 undefined —— 视为「已完成」处理完的文件。
   */
  progress?: number;
};

/** 新建知识库弹窗的表单值。 */
export type KnowledgeBaseCreateValues = {
  /** 知识库名称（必填），保存时映射到接口的 `name` */
  name: string;
  /** 描述（选填），保存时映射到接口的 `remarks` */
  description: string;
  /** 可见范围 */
  scope: 'personal' | 'shared';
  /** 共享对象（`scope` 为 `shared` 时必填） */
  target?: string;
};

export type BuiltinIconOption = {
  id: string;
  label: string;
  src: string;
};

export type AvailableBackend = {
  id: string;
  name: string;
  runtimeKey: string;
  isExtension?: boolean;
  icon?: string;
  customAgentId?: string;
  modelOptions: Array<{ value: string; label: string; description?: string }>;
};

export type KnowledgeBaseEditorViewModel = {
  isCreating: boolean;
  profile: {
    name: string;
    setName: (value: string) => void;
    description: string;
    setDescription: (value: string) => void;
    icon: string;
    setIcon: (value: string) => void;
    setIconPreview: (value: string | undefined) => void;
    iconImage?: string;
    builtinIconOptions: BuiltinIconOption[];
  };
  agent: {
    value: string;
    setValue: (value: string) => void;
    availableBackends: AvailableBackend[];
  };
  rules: {
    content: string;
    setContent: (value: string) => void;
    viewMode: 'edit' | 'preview';
    setViewMode: (value: 'edit' | 'preview') => void;
  };
  actions: {
    save: () => void;
    requestDelete: () => void;
  };
};
