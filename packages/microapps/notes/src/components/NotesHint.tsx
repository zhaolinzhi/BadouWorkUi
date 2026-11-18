/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppIcon } from '@aionui/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './NotesHint.module.css';

const NotesHint: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className={styles.hint}>
      <AppIcon name='info' size={12} />
      <span>
        {t('settings.notesHint', {
          defaultValue: 'Tip: The first line auto-syncs as the note title and renders bold + larger.',
        })}
      </span>
    </div>
  );
};

export default NotesHint;
