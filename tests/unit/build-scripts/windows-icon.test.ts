import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ICO_PATH = 'resources/app.ico';

/**
 * Read the dimensions of every image stored in an ICO file.
 * A width/height byte of 0 encodes 256 pixels.
 */
function readIcoEntries(buffer: Buffer): Array<{ width: number; height: number }> {
  expect(buffer.readUInt16LE(0)).toBe(0);
  expect(buffer.readUInt16LE(2)).toBe(1);

  const count = buffer.readUInt16LE(4);
  const entries: Array<{ width: number; height: number }> = [];

  for (let i = 0; i < count; i += 1) {
    const offset = 6 + i * 16;
    entries.push({
      width: buffer[offset] || 256,
      height: buffer[offset + 1] || 256,
    });
  }

  return entries;
}

describe('Windows application icon', () => {
  it('contains a 256x256 image, as required by electron-builder', () => {
    const entries = readIcoEntries(readFileSync(ICO_PATH));

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some(({ width, height }) => width >= 256 && height >= 256)).toBe(true);
  });
});
