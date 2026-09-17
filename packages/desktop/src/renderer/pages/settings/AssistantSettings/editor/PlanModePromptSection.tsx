import { Input } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from './editorSectionPrimitives';

type PlanModePromptSectionProps = {
  isVisible: boolean;
  isReadOnly: boolean;
  value: string;
  onChange: (value: string) => void;
  readOnlyLabel: string;
};

/**
 * Per-assistant plan-mode system prompt override.
 *
 * Only rendered when the assistant's agent backend is `aionrs` (the parent
 * gates on `isAionrsAssistant(...)`). Empty / whitespace-only input clears
 * the override and falls back to the upstream aionrs default; the backend
 * applies the same trim semantics on persist.
 */
const PlanModePromptSection: React.FC<PlanModePromptSectionProps> = ({
  isVisible,
  isReadOnly,
  value,
  onChange,
  readOnlyLabel,
}) => {
  const { t } = useTranslation();
  if (!isVisible) return null;

  return (
    <SectionCard
      title={t('settings.assistantPlanModePromptLabel', { defaultValue: 'Plan Mode Prompt' })}
      readOnly={isReadOnly}
      readOnlyLabel={readOnlyLabel}
      testId='assistant-card-plan-mode-prompt'
    >
      <div className='flex flex-col gap-6px'>
        <div className='text-12px leading-18px text-t-tertiary'>
          {t('settings.assistantPlanModePromptDescription', {
            defaultValue: '覆盖默认的计划模式系统提示词。留空则使用默认值。',
          })}
        </div>
        <div className='overflow-hidden rounded-12px border border-border-2 bg-fill-1' style={{ height: '180px' }}>
          <Input.TextArea
            value={value}
            onChange={onChange}
            placeholder={t('settings.assistantPlanModePromptPlaceholder', {
              defaultValue: '留空表示使用系统默认提示词',
            })}
            autoSize={false}
            disabled={isReadOnly}
            // NOTE: `allowClear` was intentionally removed here. Combined with
            // this component's `height: 180px` wrapper and the `!h-full` /
            // `!border-none` overrides below, arco's `arco-textarea-clear-wrapper`
            // (an inline-block wrapper added when `allowClear` is set) collapses
            // the textarea's hit area and blocks the native paste event from
            // reaching it on Electron/Chromium, even though keyboard typing
            // still works. Clearing the override is already handled by the
            // empty/whitespace string semantics in the editor hook, so the X
            // icon isn't needed here.
            data-testid='textarea-assistant-plan-mode-prompt'
            className='!h-full !rounded-none !border-none !bg-transparent'
          />
        </div>
      </div>
    </SectionCard>
  );
};

export default PlanModePromptSection;
