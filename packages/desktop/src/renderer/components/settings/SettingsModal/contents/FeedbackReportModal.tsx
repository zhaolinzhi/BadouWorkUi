/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import AionModal from '@renderer/components/base/AionModal';
import { Button, Input, Message } from '@arco-design/web-react';
import type { RefTextAreaType } from '@arco-design/web-react/es/Input/textarea';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AI_FEEDBACK_CONTENT_MAX_LENGTH,
  AI_FEEDBACK_PHONE_MAX_LENGTH,
  submitAiFeedback,
} from '@/renderer/services/feedback/submitAiFeedback';
import { useAuth } from '@/renderer/hooks/context/AuthContext';
import type {
  FeedbackDiagnosticsExplicitContext,
  FeedbackDiagnosticsProfile,
} from '@/common/types/feedbackDiagnostics';
import type { FeedbackEventExtra, FeedbackEventTags } from '@/renderer/services/feedback/submitFeedbackReport';

export type { FeedbackEventExtra, FeedbackEventTags } from '@/renderer/services/feedback/submitFeedbackReport';

export type PrefilledScreenshot = {
  filename: string;
  data: Uint8Array;
  type: string;
};

type FeedbackReportModalProps = {
  visible: boolean;
  onCancel: () => void;
  defaultModule?: string;
  prefilledScreenshots?: PrefilledScreenshot[];
  feedbackTags?: FeedbackEventTags;
  feedbackExtra?: FeedbackEventExtra;
  feedbackDiagnosticsContext?: {
    explicitContext?: FeedbackDiagnosticsExplicitContext;
    explicitProfiles?: FeedbackDiagnosticsProfile[];
    routeAtOpen?: string;
  };
};

const FeedbackReportModal: React.FC<FeedbackReportModalProps> = ({ visible, onCancel }) => {
  const { t } = useTranslation();
  const { user, notifyTokenExpired } = useAuth();

  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const descriptionRef = useRef<RefTextAreaType | null>(null);

  const resetForm = useCallback(() => {
    setPhone('');
    setDescription('');
    setError('');
  }, []);

  // Auto-focus the description textarea when the modal opens so users can
  // start typing immediately. Deferred one frame after the open transition so
  // ModalWrapper's internal focus lock has finished installing its traps.
  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(() => {
      descriptionRef.current?.focus?.();
    }, 80);
    return () => window.clearTimeout(id);
  }, [visible]);

  const handleCancel = useCallback(() => {
    resetForm();
    onCancel();
  }, [onCancel, resetForm]);

  const isFormValid = phone.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = useCallback(async () => {
    if (!phone.trim() || !description.trim()) return;

    setError('');
    setSubmitting(true);
    try {
      const token = user?.token;
      if (!token) {
        setError(t('settings.bugReportLoginRequired'));
        return;
      }

      const result = await submitAiFeedback({
        content: description.trim(),
        phone: phone.trim(),
        token,
      });

      if (result.ok === true) {
        Message.success(t('settings.bugReportSuccess'));
        resetForm();
        onCancel();
        return;
      }

      if (result.reason === 'unauthorized') {
        notifyTokenExpired('feedback');
        return;
      }

      if (result.reason === 'business') {
        setError(result.message);
        return;
      }

      // network
      setError(result.message || t('settings.bugReportError'));
    } finally {
      setSubmitting(false);
    }
  }, [phone, description, t, user, notifyTokenExpired, onCancel, resetForm]);

  return (
    <AionModal
      variant='standard'
      header={{ title: t('settings.bugReportTitle'), showClose: true }}
      visible={visible}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText={t('settings.bugReportSubmit')}
      cancelText={t('settings.bugReportCancel')}
      okButtonProps={{ disabled: !isFormValid }}
      alignCenter
      footer={{
        render: () => (
          <div className='flex items-center justify-end gap-8px'>
            <Button onClick={handleCancel} className='px-20px min-w-80px' style={{ borderRadius: 8 }}>
              {t('settings.bugReportCancel')}
            </Button>
            <Button
              type='primary'
              loading={submitting}
              disabled={!isFormValid}
              onClick={() => void handleSubmit()}
              className='px-20px min-w-80px'
              style={{ borderRadius: 8 }}
            >
              {t('settings.bugReportSubmit')}
            </Button>
          </div>
        ),
      }}
      className='w-[min(600px,calc(100vw-32px))] max-w-600px'
      autoFocus={false}
      // The feedback modal is global and may be opened from inside another
      // AionModal (e.g. the Agent editor). Arco's default z-index stacks
      // modals in mount order, which leaves the feedback modal under the
      // pre-existing modal when both are open. Bump wrap+mask above the
      // standard 1001 so feedback always appears on top.
      wrapStyle={{ zIndex: 1050 }}
      maskStyle={{ zIndex: 1050 }}
    >
      <div data-testid='feedback-report-scroll-body' className='overflow-x-hidden'>
        <div className='flex flex-col gap-16px'>
          {/* Phone */}
          <div className='flex flex-col gap-4px'>
            <label className='text-13px text-t-secondary'>
              {t('settings.bugReportPhoneLabel')} <span className='text-red-500'>*</span>
            </label>
            <Input
              data-testid='feedback-report-phone-input'
              placeholder={t('settings.bugReportPhonePlaceholder')}
              value={phone}
              onChange={(val) => {
                setPhone(val);
                setError('');
              }}
              maxLength={AI_FEEDBACK_PHONE_MAX_LENGTH}
              allowClear
            />
          </div>

          {/* Description */}
          <div className='flex flex-col gap-4px'>
            <label className='text-13px text-t-secondary'>
              {t('settings.bugReportDescriptionLabel')} <span className='text-red-500'>*</span>
            </label>
            <Input.TextArea
              ref={descriptionRef}
              placeholder={t('settings.bugReportDescriptionPlaceholder')}
              value={description}
              onChange={(val) => {
                setDescription(val);
                setError('');
              }}
              maxLength={AI_FEEDBACK_CONTENT_MAX_LENGTH}
              showWordLimit
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </div>

          {error ? (
            <div
              data-testid='feedback-report-error'
              className='px-12px py-8px bg-red-50 dark:bg-red-900/20 rd-8px text-13px text-red-500 b-1px b-solid b-red-200 dark:b-red-800'
            >
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </AionModal>
  );
};

export default FeedbackReportModal;
