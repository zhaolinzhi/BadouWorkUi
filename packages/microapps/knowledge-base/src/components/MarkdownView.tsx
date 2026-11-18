/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 知识库描述的**只读** Markdown 预览。
 *
 * 为什么不用 shell 的 `@renderer/components/Markdown`:那份组件依赖
 * `conversation/Preview`、`PreviewContext`、`LocalImageView`、`CodeBlock`
 * (react-syntax-highlighter)、`MermaidBlock`(mermaid)、`ShadowView`、
 * `@/common` 等一整棵会话子系统的树。qiankun 沙箱里这些路径拿不到,且知识库
 * 用不到其中任何一项 —— `RulesSection` 只是把「描述」这段 Markdown 渲染出来
 * 给用户看,没有复制按钮、没有聊天内联图片、没有图表、没有流式 shadow。
 *
 * 因此这里只保留 markdown 语义本身:GFM 表格 / 删除线、软换行、数学公式。
 * 后续如果知识库要展示带图片 / 代码块的描述,应该扩展这里,而不是把 shell 的
 * Markdown 组件拖进来。
 */
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import styles from './MarkdownView.module.css';

export type MarkdownViewProps = {
  children: string;
  /**
   * shell 的 `Markdown` 组件有这个 prop,知识库调用时传 `true`。
   * 这里保留同名同义 —— 代码块本就不渲染复制按钮,无需处理。
   */
  hiddenCodeCopyButton?: boolean;
};

const MarkdownView: React.FC<MarkdownViewProps> = ({ children }) => {
  const components = useMemo(
    () => ({
      a: ({ children: linkChildren, ...rest }: { children?: React.ReactNode }) => (
        <a {...rest} target='_blank' rel='noreferrer'>
          {linkChildren}
        </a>
      ),
    }),
    []
  );

  return (
    <div className={styles.kbMarkdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={components as never}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownView;
