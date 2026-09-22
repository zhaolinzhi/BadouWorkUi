/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/** Discriminated mention kinds currently supported in the send box `@`-menu. */
export type AtMentionKind = 'file' | 'kb';

/** A workspace-file mention — paths resolved by the backend agent. */
export type FileAtMention = {
  kind: 'file';
  path: string;
  name: string;
  relativePath?: string;
};

/** A remote knowledge-base mention — routed to the KB streaming endpoint. */
export type KbAtMention = {
  kind: 'kb';
  kbId: string;
  name: string;
  isShared: boolean;
};

export type AtMention = FileAtMention | KbAtMention;