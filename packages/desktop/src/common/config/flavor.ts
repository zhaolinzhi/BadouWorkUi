/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * End-user-visible behavior toggle.
 *
 * - 'enterprise' (default): full feature set, including the Task Center
 *   sidebar entry.
 * - 'public': hides the Task Center sidebar entry from end users. Page code,
 *   routes, and IPC bridges remain in the bundle so internal references
 *   still compile, but the UI never surfaces them.
 *
 * Flip this constant and rebuild to switch the shipped flavor.
 */
export const FLAVOR: 'public' | 'enterprise' = 'enterprise';
