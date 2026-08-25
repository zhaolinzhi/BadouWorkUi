/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { buildStartTaskPrefillPrompt } from '@/renderer/pages/task-center/TaskCenterDetailModal';
import type { TaskCenterRow } from '@/renderer/pages/task-center/useTaskCenterList';

const baseItem: TaskCenterRow = {
  id: '1',
  name: '策略库调整',
  mark: 'BD-AI-T001',
  projectName: '八斗AI-应用服务支撑平台',
  projectId: 'p1',
  partName: '策略库管理',
  milestoneName: '2024.04.15',
  type: 0,
  typeDesc: '开发任务',
  urgency: 0,
  urgencyDesc: '紧急',
  status: 0,
  statusDesc: '未开展',
  deadlineTime: '2024-04-12',
  startTime: null,
  endTime: null,
  closeTime: null,
  creator: 'c',
  creatorName: '黄纯敏',
  currentUserId: 'u',
  currentUserName: '赵琳芝',
  updator: 'u',
  updatorName: '黄纯敏',
  createTime: '2024-04-10 09:57:08',
  updateTime: '2024-04-10 09:57:08',
  content: '1、列表策略定义按钮移动到每一行数据右侧操作字段',
  remark: null,
  raw: {},
};

describe('buildStartTaskPrefillPrompt', () => {
  it('renders all three lines with full-width colons', () => {
    const out = buildStartTaskPrefillPrompt(baseItem);
    expect(out).toBe(
      '项目名称：八斗AI-应用服务支撑平台\n所属模块：策略库管理\n任务内容：1、列表策略定义按钮移动到每一行数据右侧操作字段'
    );
  });

  it('renders an empty value after the colon when content is null', () => {
    const out = buildStartTaskPrefillPrompt({ ...baseItem, content: null });
    const lines = out.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('项目名称：八斗AI-应用服务支撑平台');
    expect(lines[1]).toBe('所属模块：策略库管理');
    expect(lines[2]).toBe('任务内容：');
  });

  it('renders blank values after colons when projectName and partName are empty', () => {
    const out = buildStartTaskPrefillPrompt({ ...baseItem, projectName: '', partName: '' });
    const [line1, line2, line3] = out.split('\n');
    expect(line1).toBe('项目名称：');
    expect(line2).toBe('所属模块：');
    expect(line3).toBe('任务内容：1、列表策略定义按钮移动到每一行数据右侧操作字段');
  });
});