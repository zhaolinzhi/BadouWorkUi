/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 空态插画 —— 设计稿 `.kb-illustration`。
 *
 * 七个图层叠出来的（背景圆 + 两张卡片 + 书 + 三条线），每层的绝对定位、
 * 旋转角度都照设计稿的坐标抄的，不能改 —— 改了就会散架。
 *
 * 素材来自设计稿的 preview/assets（c52a6 / 3e45d / 3e34a / 95491 / 5669d /
 * 1c559.svg），搬进来时按用途改名。
 */

import React from 'react';

import emptyBackground from '../../assets/illustrations/empty-background.svg';
import emptyBook from '../../assets/illustrations/empty-book.svg';
import emptyCardBack from '../../assets/illustrations/empty-card-back.svg';
import emptyCardFront from '../../assets/illustrations/empty-card-front.svg';
import emptyLine from '../../assets/illustrations/empty-line.svg';
import emptyLineShort from '../../assets/illustrations/empty-line-short.svg';
import styles from './KnowledgeBaseEmptyIllustration.module.css';

const KnowledgeBaseEmptyIllustration: React.FC = () => (
  <div className={styles.illustration} aria-hidden='true' data-testid='kb-empty-illustration'>
    <img className={`${styles.layer} ${styles.background}`} src={emptyBackground} alt='' />
    <img className={`${styles.layer} ${styles.back}`} src={emptyCardBack} alt='' />
    <img className={`${styles.layer} ${styles.front}`} src={emptyCardFront} alt='' />
    <img className={`${styles.layer} ${styles.book}`} src={emptyBook} alt='' />
    <img className={`${styles.layer} ${styles.lineA}`} src={emptyLine} alt='' />
    <img className={`${styles.layer} ${styles.lineB}`} src={emptyLine} alt='' />
    <img className={`${styles.layer} ${styles.lineC}`} src={emptyLineShort} alt='' />
  </div>
);

export default KnowledgeBaseEmptyIllustration;
