/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Input, Modal, Select, Tooltip } from '@arco-design/web-react';
import { AppIcon } from '@aionui/ui';
import styles from './RecordingSettingsModal.module.css';

export type RecordingSettingsModalProps = {
  visible: boolean;
  /**
   * 生成默认录音名称(自动命名)—— 打开弹窗时填进输入框。
   *
   * 传函数而不是字符串:默认名带当前时间,只有在**打开的那一刻**才算得出
   * 一份准确的名字;传字符串的话调用方必须提前渲染时就把它算好。
   */
  buildDefaultName: () => string;
  /** 关闭弹窗,不录音。 */
  onCancel: () => void;
  /** 确认开始录音,回传用户填的录音名称。 */
  onConfirm: (name: string) => void;
};

/**
 * 录音设置弹窗 —— 对齐设计稿 BadouWork-Desktop-Handoff 的 `record-settings`
 * (以及展开后的 `record-settings-more`)。
 *
 * 设计稿的关键结构:
 *   .rec-dialog.wide        640px 宽、32px 内边距、16px 圆角
 *   .rec-source-options     两张并排的来源卡片,选中态浅蓝底 + 浅蓝描边
 *   .rec-info(.blue)        状态提示块
 *   .rec-more-settings      「更多设置 / 收起设置」一行
 *   .rec-advanced           展开后的录音名称输入 + 设备 / 语言选择
 *
 * 能力边界
 * ========
 * 目前只有**麦克风**这一种来源真的能录(浏览器的 `getUserMedia`),系统声音、
 * 指定麦克风设备与识别语言都没有对应的底层能力 —— 所以:
 *   - 录音名称:可用,确认后会成为这条录音的名字;
 *   - 录音来源:只能勾麦克风,系统声音置灰;
 *   - 麦克风设备 / 识别语言:置灰,只显示当前默认值。
 */
const RecordingSettingsModal: React.FC<RecordingSettingsModalProps> = ({
  visible,
  buildDefaultName,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [micSelected, setMicSelected] = useState(true);
  const [advanced, setAdvanced] = useState(false);
  const [name, setName] = useState('');

  // 每次打开都回到初始状态:名字回到自动命名,高级设置收起。
  // 自动命名在**打开的那一刻**才算 —— 名字里带当前时间,提前算会过时。
  useEffect(() => {
    if (!visible) return;
    setMicSelected(true);
    setAdvanced(false);
    setName(buildDefaultName());
  }, [visible, buildDefaultName]);

  const unsupportedHint = t('meeting-recording.settings.unsupportedHint', {
    defaultValue: '系统声音、麦克风设备与识别语言尚未支持',
  });

  return (
    <Modal
      visible={visible}
      onCancel={onCancel}
      className={styles.modal}
      style={{ width: 640 }}
      title={
        <div className={styles.header}>
          <h2 className={styles.title}>{t('meeting-recording.settings.title', { defaultValue: '录音设置' })}</h2>
          <p className={styles.description}>
            {t('meeting-recording.settings.description', { defaultValue: '按需调整声音来源，确认后开始录音。' })}
          </p>
        </div>
      }
      footer={
        <div className={styles.footer}>
          <Button className={styles.footerButton} onClick={onCancel}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button
            type='primary'
            className={styles.footerPrimaryButton}
            disabled={!micSelected}
            onClick={() => onConfirm(name.trim())}
            data-testid='recording-settings-start'
          >
            {t('meeting-recording.startRecording', { defaultValue: '开始录音' })}
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        <section className={styles.section}>
          <p className={styles.sectionTitle}>
            {t('meeting-recording.settings.sourcesLabel', { defaultValue: '录音来源（可多选）' })}
          </p>
          <p className={styles.sectionHint}>
            {t('meeting-recording.settings.sourcesHint', { defaultValue: '至少选择一项；线上会议可同时勾选两项。' })}
          </p>

          <div className={styles.sourceOptions}>
            {/*
              卡片本身可点(整块切换来源),但真正的表单控件是 Arco 的 Checkbox ——
              Arco 的 Checkbox 内部已经渲染了一个 `<label>`,外面不能再套 label,
              所以这里用 div + onClick,并拦住 Checkbox 上的冒泡,避免一次点击
              触发两次切换。
            */}
            <div
              className={`${styles.sourceOption} ${micSelected ? styles.sourceOptionActive : ''}`}
              onClick={() => setMicSelected(true)}
            >
              <AppIcon name='nav-recording' size={24} className={styles.sourceIcon} />
              <span className={styles.sourceCopy}>
                <span className={styles.sourceName}>
                  {t('meeting-recording.settings.sourceMic', { defaultValue: '麦克风' })}
                </span>
                <span className={styles.sourceDescription}>
                  {t('meeting-recording.settings.sourceMicDescription', { defaultValue: '记录你和身边的声音' })}
                </span>
              </span>
              <Checkbox
                checked={micSelected}
                onChange={(checked) => setMicSelected(checked)}
                onClick={(event) => event.stopPropagation()}
                aria-label={t('meeting-recording.settings.sourceMic', { defaultValue: '麦克风' })}
              />
            </div>

            <Tooltip content={unsupportedHint}>
              <span className={styles.disabledWrapper}>
                <div className={`${styles.sourceOption} ${styles.sourceOptionDisabled}`}>
                  <AppIcon name='volume-notice' size={24} className={styles.sourceIcon} />
                  <span className={styles.sourceCopy}>
                    <span className={styles.sourceName}>
                      {t('meeting-recording.settings.sourceSystem', { defaultValue: '系统声音' })}
                    </span>
                    <span className={styles.sourceDescription}>
                      {t('meeting-recording.settings.sourceSystemDescription', { defaultValue: '记录电脑播放的声音' })}
                    </span>
                  </span>
                  <Checkbox
                    disabled
                    aria-label={t('meeting-recording.settings.sourceSystem', { defaultValue: '系统声音' })}
                  />
                </div>
              </span>
            </Tooltip>
          </div>

          {/*
            设计稿里这段提示只在「更多设置」收起时出现 —— 展开后提示块会被
            高级设置区顶掉,避免弹窗被撑得太高。
          */}
          {advanced ? null : (
            <div className={`${styles.info} ${micSelected ? styles.infoBlue : ''}`}>
              <strong className={styles.infoTitle}>
                {micSelected
                  ? t('meeting-recording.settings.readyTitle', { defaultValue: '麦克风已就绪' })
                  : t('meeting-recording.settings.noSourceTitle', { defaultValue: '请至少选择一种录音来源' })}
              </strong>
              <p className={styles.infoDescription}>
                {micSelected
                  ? t('meeting-recording.settings.readyDescription', { defaultValue: '仅录制你和周围的声音。' })
                  : t('meeting-recording.settings.noSourceDescription', {
                      defaultValue: '勾选任意一项后，即可开始录音。',
                    })}
              </p>
            </div>
          )}
        </section>

        <div className={styles.moreRow}>
          <Button type='text' className={styles.moreButton} onClick={() => setAdvanced((value) => !value)}>
            {advanced
              ? t('meeting-recording.settings.collapseSettings', { defaultValue: '收起设置' })
              : t('meeting-recording.settings.moreSettings', { defaultValue: '更多设置' })}
          </Button>
          <span className={styles.moreSummary}>
            {advanced
              ? t('meeting-recording.settings.moreSettingsSummary', { defaultValue: '名称、麦克风设备与识别语言' })
              : t('meeting-recording.settings.autoNamingSummary', { defaultValue: '自动命名 · 中文普通话' })}
          </span>
          <AppIcon
            name='chevron-down'
            size={12}
            className={`${styles.moreChevron} ${advanced ? styles.moreChevronOpen : ''}`}
          />
        </div>

        {advanced ? (
          <div className={styles.advanced}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>
                {t('meeting-recording.settings.nameLabel', { defaultValue: '录音名称（选填）' })}
              </span>
              <Input
                value={name}
                onChange={setName}
                aria-label={t('meeting-recording.settings.nameLabel', { defaultValue: '录音名称（选填）' })}
              />
            </div>
            <div className={styles.fieldRow}>
              {/*
                设备与语言置灰 —— 还没有「选设备 / 选语言」的底层能力。
                disabled 的控件不派发鼠标事件,Tooltip 必须挂在外层 span 上。
              */}
              <Tooltip content={unsupportedHint}>
                <span className={styles.disabledWrapper}>
                  <Select
                    disabled
                    value='default-device'
                    aria-label={t('meeting-recording.settings.deviceLabel', { defaultValue: '麦克风设备' })}
                    options={[
                      {
                        value: 'default-device',
                        label: t('meeting-recording.settings.deviceDefault', { defaultValue: '系统默认麦克风' }),
                      },
                    ]}
                  />
                </span>
              </Tooltip>
              <Tooltip content={unsupportedHint}>
                <span className={styles.disabledWrapper}>
                  <Select
                    disabled
                    value='zh-CN'
                    aria-label={t('meeting-recording.settings.languageLabel', { defaultValue: '识别语言' })}
                    options={[
                      {
                        value: 'zh-CN',
                        label: t('meeting-recording.settings.languageDefault', { defaultValue: '中文普通话' }),
                      },
                    ]}
                  />
                </span>
              </Tooltip>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default RecordingSettingsModal;
