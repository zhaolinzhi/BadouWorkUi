/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import ThumbnailImage, { resizeSvgDocument } from '@/renderer/components/media/ThumbnailImage';

const SVG_SOURCE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="2304" height="1856"><rect width="10" height="10"/></svg>';

const svgResponse = (body: string) =>
  ({
    ok: true,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null) },
    text: async () => body,
  }) as unknown as Response;

const pngResponse = () =>
  ({
    ok: true,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) },
    blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
  }) as unknown as Response;

/**
 * jsdom never loads images, so the SVG rasterizer would hang. This stub
 * resolves `onload` as soon as a source is assigned.
 */
const stubImageDecoding = () => {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 0;
    height = 0;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('Image', FakeImage);
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('resizeSvgDocument', () => {
  it('rewrites the intrinsic size', () => {
    const result = resizeSvgDocument(SVG_SOURCE, 48);
    expect(result?.source).toContain('width="48"');
    expect(result?.source).not.toContain('width="2304"');
  });

  it('keeps the aspect ratio of the source', () => {
    const result = resizeSvgDocument(SVG_SOURCE, 48);
    expect(result?.width).toBe(48);
    expect(result?.height).toBe(Math.round((48 * 1856) / 2304));
  });

  it('derives a viewBox when the source has none', () => {
    const result = resizeSvgDocument(SVG_SOURCE, 48);
    expect(result?.source).toContain('viewBox="0 0 2304 1856"');
  });

  it('keeps an existing viewBox untouched', () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 50 50"></svg>';
    const result = resizeSvgDocument(source, 48);
    expect(result?.source).toContain('viewBox="0 0 50 50"');
    expect(result?.source).not.toContain('viewBox="0 0 100 100"');
  });

  it('returns null when there is no svg tag', () => {
    expect(resizeSvgDocument('not an svg', 48)).toBeNull();
  });
});

describe('ThumbnailImage', () => {
  it('rasterizes an SVG into a bitmap at the requested size', async () => {
    const fetchMock = vi.fn().mockResolvedValue(svgResponse(SVG_SOURCE));
    vi.stubGlobal('fetch', fetchMock);
    stubImageDecoding();
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');

    render(<ThumbnailImage src='https://example.com/logo.svg' size={24} alt='logo' />);

    const image = screen.getByAltText('logo') as HTMLImageElement;
    await waitFor(() => {
      expect(image.src).toBe('data:image/png;base64,AAAA');
    });
    expect(drawImage).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('downsamples raster images to a bitmap', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pngResponse()));
    const drawImage = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 40, height: 40, close: vi.fn() }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');

    render(<ThumbnailImage src='https://example.com/avatar.png' size={20} alt='avatar' />);

    const image = screen.getByAltText('avatar') as HTMLImageElement;
    await waitFor(() => {
      expect(image.src).toBe('data:image/png;base64,AAAA');
    });
    expect(drawImage).toHaveBeenCalled();
  });

  it('keeps the original URL when the image cannot be prepared', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<ThumbnailImage src='https://example.com/offline.svg' size={24} alt='logo' />);

    const image = screen.getByAltText('logo') as HTMLImageElement;
    await waitFor(() => {
      expect(image.src).toBe('https://example.com/offline.svg');
    });
  });

  it('never requests inline data URLs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ThumbnailImage src='data:image/svg+xml,<svg/>' size={24} alt='inline' />);

    const image = screen.getByAltText('inline') as HTMLImageElement;
    expect(image.src).toContain('data:image/svg+xml');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
