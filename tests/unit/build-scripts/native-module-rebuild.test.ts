import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const buildWorkflow = readFileSync('.github/workflows/_build-reusable.yml', 'utf8');
const rebuildScript = readFileSync('scripts/rebuildNativeModules.js', 'utf8');
const afterPackScript = readFileSync('scripts/afterPack.js', 'utf8');

describe('native module rebuild', () => {
  it('delegates the Windows CI rebuild to the shared script', () => {
    expect(buildWorkflow).toContain(
      'node scripts/rebuildNativeModules.js --platform win32 --arch $arch --electron-version $electronVer'
    );
    // Regression guard: the workflow must not hand-roll electron-rebuild CLI
    // calls again (upstream renamed --electron-version to --version in v4).
    expect(buildWorkflow).not.toContain('electron-rebuild');
  });

  it('uses the @electron/rebuild programmatic API instead of CLI flags', () => {
    expect(rebuildScript).toContain("await import('@electron/rebuild')");
    expect(rebuildScript).toContain('onlyModules:');
    // No invocation of the electron-rebuild binary; flag names cannot drift.
    expect(rebuildScript).not.toMatch(/['"]electron-rebuild['"]/);
    expect(rebuildScript).not.toMatch(/electron-rebuild\s+--/);
  });

  it('awaits the async single-module rebuild in afterPack', () => {
    expect(afterPackScript).toContain('await rebuildSingleModule({');
  });
});
