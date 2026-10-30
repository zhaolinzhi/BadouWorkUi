/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 二次确认弹窗。
 *
 * 收拢 notes 的 `DeleteConfirmModal` 与 knowledge-base 的
 * `DeleteKnowledgeBaseModal` —— 两处几乎逐字相同的 Arco `Modal` 包装
 * (同样的 `w-[90vw] md:w-[400px]` 宽度、同样的 danger 确认按钮、同样的 z-index)。
 *
 * 设计约束
 * ========
 * 1. **零内置文案**。标题、说明、按钮文字全部由调用方用
 *    `t(key, { defaultValue })` 算好再传进来 —— 共享包不在 shell 的 i18n
 *    词条体系里,硬编码违反项目规则;独立运行时也只有调用方自己的兜底靠谱。
 *    (不传 `okText` / `cancelText` 会回落到 Arco 自带的默认文案,业务代码应当始终传入。)
 * 2. **弹窗必须脱离 qiankun 容器**。Arco 的 Modal 默认就挂在 `document.body`,
 *    这里显式写出来是因为「挂哪儿」是微应用里最容易踩的坑:留在容器内会被
 *    祖先的 `overflow: hidden` 裁掉。
 * 3. **z-index 压过 shell**。`wrap` 用 10000、遮罩 9999 —— 刚好低于 shell 的
 *    `.arco-message-wrapper`(10001),于是 toast 盖在弹窗之上,这是对的:
 *    「操作失败」的提示本来就该压在确认框上面。
 */
import { Modal } from '@arco-design/web-react';
import React from 'react';

import { cx } from '../utils/cx';

export type ConfirmModalProps = {
  /** 是否显示。 */
  visible: boolean;
  /** 标题。 */
  title?: React.ReactNode;
  /** 说明文字。省略时整段不渲染。 */
  description?: React.ReactNode;
  /** 附加内容,渲染在说明文字之后。 */
  children?: React.ReactNode;
  /** 确认按钮文案。 */
  okText?: React.ReactNode;
  /** 取消按钮文案。 */
  cancelText?: React.ReactNode;
  /** 点击确认。 */
  onOk?: () => void;
  /** 点击取消(含右上角关闭图标、遮罩点击、ESC)。 */
  onCancel?: () => void;
  /** 危险操作 —— 确认按钮转成危险态(删除类操作用)。 */
  danger?: boolean;
  /** 确认按钮加载中。用于「请求已发出,等它回来」。 */
  okLoading?: boolean;
  /** 隐藏取消按钮。只有单一操作(比如「知道了」)的场景用。 */
  hideCancel?: boolean;
  /** 附加 className。 */
  className?: string;
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  description,
  children,
  okText,
  cancelText,
  onOk,
  onCancel,
  danger = false,
  okLoading = false,
  hideCancel = false,
  className,
}) => {
  return (
    <Modal
      visible={visible}
      title={title}
      onOk={onOk}
      onCancel={onCancel}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={danger ? { status: 'danger' } : undefined}
      confirmLoading={okLoading}
      hideCancel={hideCancel}
      className={cx('w-[90vw] md:w-[400px]', className)}
      wrapStyle={{ zIndex: 10000 }}
      maskStyle={{ zIndex: 9999 }}
      getPopupContainer={() => document.body}
    >
      {description ? <p className='m-0 text-13px text-t-secondary'>{description}</p> : null}
      {children}
    </Modal>
  );
};

ConfirmModal.displayName = 'ConfirmModal';

export default ConfirmModal;
