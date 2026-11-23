/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 文件类型图标的判定：接口的 `flgType` 优先，认不出来退回文件名后缀。
 */

import { describe, expect, it } from 'vitest';

import { resolveDocumentIconKind } from '../DocumentFileIcon';

describe('resolveDocumentIconKind', () => {
  it('按接口的 flgType 判定类型（大小写不敏感）', () => {
    expect(resolveDocumentIconKind('AppIcon.md', 'MD')).toBe('markdown');
    expect(resolveDocumentIconKind('性能测试报告.docx', 'DOCX')).toBe('word');
    expect(resolveDocumentIconKind('数据表.xlsx', 'XLSX')).toBe('excel');
    expect(resolveDocumentIconKind('演示.pptx', 'PPTX')).toBe('ppt');
    expect(resolveDocumentIconKind('手册.pdf', 'PDF')).toBe('pdf');
    expect(resolveDocumentIconKind('说明.txt', 'TXT')).toBe('text');
  });

  it('flgType 是数字码这类认不出来的值时，退回文件名后缀', () => {
    expect(resolveDocumentIconKind('说明.txt', '10')).toBe('text');
    expect(resolveDocumentIconKind('脚本.py', '10')).toBe('code');
    expect(resolveDocumentIconKind('压缩包.zip', '10')).toBe('archive');
    expect(resolveDocumentIconKind('照片.jpg', '10')).toBe('jpg');
  });

  it('都没有 flgType 时只看文件名后缀', () => {
    expect(resolveDocumentIconKind('设计规范.md')).toBe('markdown');
    expect(resolveDocumentIconKind('视频.mp4')).toBe('video');
    expect(resolveDocumentIconKind('音乐.mp3')).toBe('audio');
  });

  it('都认不出来时用未知文件', () => {
    expect(resolveDocumentIconKind('没有扩展名', '10')).toBe('unknown');
    expect(resolveDocumentIconKind('奇怪.zzz', '10')).toBe('unknown');
    expect(resolveDocumentIconKind('', undefined)).toBe('unknown');
  });
});
