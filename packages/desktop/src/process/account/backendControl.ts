/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Indirection between the account bridge and the backend lifecycle manager.
 *
 * The manager is constructed in `packages/desktop/src/index.ts`, which imports
 * the bridge registry — importing it back would create a cycle. The main
 * process registers the real implementations at startup; the bridge reads
 * them through this module.
 */

let getCurrentDataDir: () => string = () => '';
let start: (dataDir: string) => Promise<number> = async () => {
  throw new Error('[Account] backend control not registered');
};
let stop: () => Promise<void> = async () => {};

/** Register the real backend lifecycle functions. Called once at startup. */
export function registerBackendControl(impl: {
  getCurrentDataDir: () => string;
  start: (dataDir: string) => Promise<number>;
  stop: () => Promise<void>;
}): void {
  getCurrentDataDir = impl.getCurrentDataDir;
  start = impl.start;
  stop = impl.stop;
}

/** The data directory the running backend was started against. */
export function getCurrentBackendDataDir(): string {
  return getCurrentDataDir();
}

/** Start the backend against a specific data directory. Resolves to its port. */
export function startBackendForAccount(dataDir: string): Promise<number> {
  return start(dataDir);
}

/** Stop the running backend, releasing its data-directory lock and port. */
export function stopBackendForAccount(): Promise<void> {
  return stop();
}

/** Reset the registered implementations. Test-only. */
export function __resetBackendControlForTests(): void {
  getCurrentDataDir = () => '';
  start = async () => {
    throw new Error('[Account] backend control not registered');
  };
  stop = async () => {};
}
