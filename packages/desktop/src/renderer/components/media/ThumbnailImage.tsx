/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';

/**
 * Image that is handed to the browser at the size it is actually shown at.
 *
 * Why this exists
 * ===============
 * Chromium rasterizes an `<img>` at the image's *intrinsic* size and scales
 * the result down afterwards. The assets the backend serves are not authored
 * for icon sizes: a brand logo is a 2304x1856 SVG, an assistant avatar is a
 * 1024x1024 PNG, and both are shown at 16-20px. Whenever the surrounding
 * layout changed, Chromium had to re-rasterize those multi-megapixel
 * sources — measured at ~900ms of raster work for a single sidebar
 * collapse/expand, which is what made that animation stutter.
 *
 * This component sidesteps the problem by handing the browser a copy that is
 * already the right size *and* already a bitmap:
 *  - SVG is rasterized once into a small PNG, so the browser only ever blits
 *    it. Keeping the vector around is not enough: Chromium re-runs the vector
 *    rasterizer on every repaint, which measured at 82ms for a single 40px
 *    logo — with several logos on the page that alone blew the frame budget;
 *  - raster images are downsampled once into a small bitmap.
 *
 * The result is cached per (url, size) pair, so every asset is processed once
 * per session.
 */

/** Cache of already prepared thumbnails, keyed by `${url}@${size}`. */
const thumbnailCache = new Map<string, string>();

/** Device pixel ratio the thumbnails are prepared for, capped to keep them small. */
const MAX_THUMBNAIL_DPR = 3;

const isInlineData = (src: string): boolean => src.startsWith('data:') || src.startsWith('blob:');

/** A resized SVG document together with its intrinsic size. */
export type ResizedSvg = {
  /** The SVG source with rewritten `width`/`height`. */
  source: string;
  /** Intrinsic width in pixels. */
  width: number;
  /** Intrinsic height in pixels. */
  height: number;
};

/**
 * Rewrite the intrinsic size of an SVG document, keeping its aspect ratio.
 *
 * The aspect ratio matters: the logos the backend serves are 2304x1856, and
 * squashing them into a square box would visibly distort them. The `viewBox`
 * is derived from the original size when the document does not have one,
 * because an SVG without a `viewBox` is cropped when its size changes.
 *
 * Returns `null` when the document's intrinsic size cannot be determined.
 * Exported for testing.
 */
export const resizeSvgDocument = (svg: string, size: number): ResizedSvg | null => {
  const tagMatch = svg.match(/<svg[^>]*>/i);
  if (!tagMatch) return null;
  const originalTag = tagMatch[0];

  let tag = originalTag;
  let ratio: number | null = null;

  const viewBoxMatch = tag.match(/\sviewBox="([^"]*)"/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) ratio = parts[3] / parts[2];
  } else {
    const widthAttr = tag.match(/\swidth="([^"]*)"/i);
    const heightAttr = tag.match(/\sheight="([^"]*)"/i);
    const width = widthAttr ? parseFloat(widthAttr[1]) : NaN;
    const height = heightAttr ? parseFloat(heightAttr[1]) : NaN;
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      ratio = height / width;
      tag = tag.replace(/<svg/i, `<svg viewBox="0 0 ${width} ${height}"`);
    }
  }
  if (ratio === null) return null;

  const width = Math.max(1, Math.round(size));
  const height = Math.max(1, Math.round(size * ratio));

  // Replace the size attributes, adding them when the document has none.
  tag = tag.replace(/\swidth="[^"]*"/i, '').replace(/\sheight="[^"]*"/i, '');
  tag = tag.replace(/<svg/i, `<svg width="${width}" height="${height}"`);

  return { source: svg.replace(originalTag, tag), width, height };
};

/** Rasterize an SVG document into a PNG data URL at the requested size. */
const rasterizeSvg = async (svg: string, target: number): Promise<string | null> => {
  const resized = resizeSvgDocument(svg, target);
  if (!resized) return null;

  const image = new Image();
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(resized.source)}`;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('svg decode failed'));
    image.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;
  const context = canvas.getContext('2d');
  if (!context) return null;

  // Fit the SVG into the square canvas the way `object-contain` would, so the
  // bitmap looks exactly like the original element did.
  const scale = Math.min(target / resized.width, target / resized.height);
  const drawWidth = resized.width * scale;
  const drawHeight = resized.height * scale;
  context.drawImage(image, (target - drawWidth) / 2, (target - drawHeight) / 2, drawWidth, drawHeight);

  return canvas.toDataURL('image/png');
};

/**
 * Prepare a thumbnail for `src` at `size` CSS pixels.
 *
 * Returns `null` when the image cannot be prepared — the caller then keeps
 * using the original URL, so a failure only costs performance, never
 * correctness.
 */
export const buildThumbnail = async (src: string, size: number): Promise<string | null> => {
  if (isInlineData(src)) return null;

  const target = Math.max(16, Math.round(size * Math.min(window.devicePixelRatio || 1, MAX_THUMBNAIL_DPR)));

  try {
    const url = new URL(src, window.location.origin).toString();
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('svg')) {
      const svg = await response.text();
      if (!svg.includes('<svg')) return null;
      return await rasterizeSvg(svg, target);
    }

    const blob = await response.blob();
    if (!blob.size) return null;
    // Only one dimension is given, so the bitmap keeps its aspect ratio.
    const bitmap = await createImageBitmap(blob, { resizeWidth: target, resizeQuality: 'high' });
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
};

/** Resolve the thumbnail for `src`, or the original URL while it is prepared. */
export const useThumbnailSrc = (src: string, size: number): string => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    if (!src || isInlineData(src)) {
      setThumbnail(null);
      return undefined;
    }
    const key = `${src}@${size}`;
    const cached = thumbnailCache.get(key);
    if (cached) {
      setThumbnail(cached);
      return undefined;
    }
    let cancelled = false;
    setThumbnail(null);
    void buildThumbnail(src, size).then((prepared) => {
      if (cancelled || !prepared) return;
      thumbnailCache.set(key, prepared);
      setThumbnail(prepared);
    });
    return () => {
      cancelled = true;
    };
  }, [src, size]);

  return thumbnail ?? src;
};

export type ThumbnailImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  /** Original image URL. */
  src: string;
  /** Size the image is displayed at, in CSS pixels. */
  size: number;
};

/**
 * An `<img>` that is rasterized at the size it is displayed at.
 *
 * Use it for icons and avatars that are shown small but served large — model
 * logos, assistant avatars, brand marks.
 */
const ThumbnailImage: React.FC<ThumbnailImageProps> = ({ src, size, ...rest }) => {
  const resolvedSrc = useThumbnailSrc(src, size);
  return <img src={resolvedSrc} {...rest} />;
};

export default ThumbnailImage;
