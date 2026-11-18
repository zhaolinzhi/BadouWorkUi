import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveBinaryPath } from './binaryResolver';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

const originalResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

function setResourcesPath(resourcesPath: string | undefined): void {
  Object.defineProperty(process, 'resourcesPath', {
    configurable: true,
    value: resourcesPath,
  });
}

function dirEntry(name: string, isDirectory = false): ReturnType<typeof readdirSync>[number] {
  return {
    name,
    isDirectory: () => isDirectory,
  } as unknown as ReturnType<typeof readdirSync>[number];
}

describe('resolveBinaryPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setResourcesPath(originalResourcesPath);
  });

  it('falls back to the repo resources dir when Electron resourcesPath lacks the bundle (dev mode)', () => {
    const runtimeKey = `${process.platform}-${process.arch}`;
    const binaryName = process.platform === 'win32' ? 'aioncore.exe' : 'aioncore';
    const devResources = join(process.cwd(), 'resources');
    const binaryPath = join(devResources, 'bundled-aioncore', runtimeKey, binaryName);

    setResourcesPath('/app/resources'); // Electron's own Resources dir (dev mode)
    vi.mocked(existsSync).mockImplementation((path) => path === binaryPath);
    vi.mocked(readdirSync).mockImplementation((path) => {
      if (path === devResources) return [dirEntry('bundled-aioncore', true)];
      if (path === join(devResources, 'bundled-aioncore', runtimeKey)) return [dirEntry(binaryName)];
      return [] as ReturnType<typeof readdirSync>;
    });

    expect(resolveBinaryPath()).toBe(binaryPath);
  });

  it('warns when it falls back to a PATH binary because the bundled one is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resourcesPath = '/app/resources';
    const runtimeKey = `${process.platform}-${process.arch}`;
    const binaryName = process.platform === 'win32' ? 'aioncore.exe' : 'aioncore';
    const pathBinary = '/usr/local/bin/aioncore';

    setResourcesPath(resourcesPath);
    vi.mocked(existsSync).mockImplementation((path) => path === pathBinary);
    vi.mocked(readdirSync).mockImplementation(() => [] as ReturnType<typeof readdirSync>);
    vi.mocked(execSync).mockReturnValue(pathBinary);

    expect(resolveBinaryPath()).toBe(pathBinary);

    const message = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(message).toContain(pathBinary);
    // 告警里要指名「随包后端本来该在哪」,用户才找得到地方补
    expect(message).toContain('bundled-aioncore');
    expect(message).toContain(runtimeKey);
    expect(message).toContain(binaryName);
    // 提示里必须说清「怎么恢复」,否则看到日志也不知道该做什么
    expect(message).toContain('prepareAioncore');

    warn.mockRestore();
  });

  it('attaches bundled path diagnostics when aioncore cannot be resolved', () => {
    const resourcesPath = '/app/resources';
    const runtimeKey = `${process.platform}-${process.arch}`;
    const binaryName = process.platform === 'win32' ? 'aioncore.exe' : 'aioncore';
    const bundledDir = join(resourcesPath, 'bundled-aioncore');
    const runtimeDir = join(bundledDir, runtimeKey);
    const checkedBundledPath = join(runtimeDir, binaryName);

    setResourcesPath(resourcesPath);
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readdirSync).mockImplementation((path) => {
      if (path === resourcesPath) return [dirEntry('bundled-aioncore', true)];
      if (path === runtimeDir) return [dirEntry('manifest.json')];
      return [] as ReturnType<typeof readdirSync>;
    });
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not found on PATH');
    });

    expect(() => resolveBinaryPath()).toThrow('Cannot find "aioncore" binary');

    try {
      resolveBinaryPath();
    } catch (error) {
      expect(error).toMatchObject({
        name: 'BackendBinaryResolveError',
        diagnostics: expect.objectContaining({
          resourcesPath,
          runtimeKey,
          binaryName,
          checkedBundledPath,
          bundledDirExists: false,
          runtimeDirExists: false,
          resourcesDirEntries: ['bundled-aioncore/'],
          runtimeDirEntries: ['manifest.json'],
          pathLookupCommand: process.platform === 'win32' ? 'where aioncore' : 'which aioncore',
          pathLookupError: expect.stringContaining('not found on PATH'),
        }),
      });
    }
  });
});
