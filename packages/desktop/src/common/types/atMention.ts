/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/** Discriminated mention kinds currently supported in the send box `@`-menu. */
export type AtMentionKind = 'file' | 'kb';

/** A workspace-file mention — paths resolved by the backend agent. */
export type FileAtMention = {
  kind: AtMentionKind;
  path: string;
  name: string;
  /** Relative path used by the agent to resolve the file; absent for KB mentions. */
  relativePath?: string;
};

/** A remote knowledge-base mention — routed to the KB streaming endpoint. */
export type KbAtMention = {
  kind: AtMentionKind;
  kbId: string;
  name: string;
  /**
   * Whether the mention originates from the shared KB index; drives menu-section
   * labeling only.
   */
  isShared: boolean;
};

export type AtMention = FileAtMention | KbAtMention;
