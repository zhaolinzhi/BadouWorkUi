/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SVG 文件 → React 组件模块代码(纯函数,不碰文件系统)。
 *
 * 为什么在**编译期**转换
 * ====================
 * 转换发生在构建期,产物是一个**普通 React 组件** —— 和手写出来的组件完全等价:
 *   - 运行时没有 SVG 解析、没有额外 HTTP 请求、没有全局注册表;
 *   - **启动开销 = 0**,多出来的只有构建期每个图标几毫秒的转换时间;
 *   - bundle 体积与手写组件相当(SVG 路径数据本来就要进包)。
 *
 * 反过来,运行时才去解析 SVG(比如 `dangerouslySetInnerHTML` 塞一坨字符串、
 * 或者 `<img src>` 拉一张图)才是真正会给启动添负担的做法 —— 本模块不走那条路。
 *
 * 转换规则(与 `docs/contributing/ui-components/app-icon.md` 的「路径 B」一致)
 * ======================================================================
 * 1. 保留几何属性(`d` / `cx` / `points` …),**删掉** `stroke` / `stroke-width` /
 *    `stroke-linecap` / `stroke-linejoin` —— 它们由外层 `<svg>` 统一提供,
 *    删掉才能让 `AppIcon` 的 `size` / `fill` / `strokeWidth` 真的生效。
 *    (`stroke="none"` 保留 —— 那是「这一笔不描边」的意思。)
 * 2. `viewBox` 原样保留 —— 改了形状会变形。
 * 3. 写死的颜色保持原样,并给出提示 —— 它不跟随主题,得让人知道。
 * 4. 属性名改成 React 的驼峰写法 —— `clip-path` → `clipPath`、`fill-rule` → `fillRule`,
 *    JSX/React 不接受带连字符的属性名,不改会打「Invalid DOM property」警告。
 */
import { DOMParser } from '@xmldom/xmldom';

/** 由外层 `<svg>` 统一提供的描边属性 —— 子元素上出现就要删掉。 */
const INHERITED_STROKE_ATTRS = new Set(['stroke-width', 'stroke-linecap', 'stroke-linejoin']);

/** React 原样接受、不做驼峰转换的属性前缀。 */
const PASSTHROUGH_ATTR_PREFIXES = ['data-', 'aria-'];

/** 写死的颜色 —— 不会跟随主题,要提示。 */
const HARDCODED_COLOR = /^(#|rgb\(|rgba\(|hsl\(|hsla\()/i;

/**
 * `AppIcon` 的默认描边宽度。
 *
 * 定制图标按**设计稿自己的比例**换算:`strokeScale = 设计稿描边宽 / 3`,
 * 于是 `strokeWidth={3}` 复现设计稿的粗细。24 画布 + 1.5 描边(6.25%)
 * 与 icon-park 恰好同比例,两套图标看起来一样粗。
 */
const REFERENCE_STROKE_WIDTH = 3;

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;

const LINE_CAPS = new Set(['butt', 'round', 'square']);
const LINE_JOINS = new Set(['miter', 'round', 'bevel']);

/** 转换出来的元素节点。 */
export type SvgElementNode = {
  /** 标签名 —— 保留大小写(`clipPath` / `linearGradient` 不能改成小写)。 */
  tag: string;
  /** React props —— 属性名已是驼峰写法。 */
  props: Record<string, string | Record<string, string>>;
  /** 子节点 —— 元素或文本。 */
  children: Array<SvgElementNode | string>;
};

export type ConvertSvgOptions = {
  /** 组件名(一般是文件名)—— 用于 CSS class(`i-icon-<name>`)与元素 id 前缀。 */
  name: string;
  /** 生成代码里 `createCustomIcon` 的 import 说明符。 */
  factoryImport: string;
};

export type ConvertSvgResult = {
  /** 生成的模块代码。 */
  code: string;
  /** 转换过程中的提示(写死的颜色等)—— 构建时打印。 */
  warnings: string[];
};

/** 传给 `createCustomIcon` 的选项。 */
type IconOptions = {
  viewBox: string;
  fill?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  strokeScale?: number;
};

/**
 * 把一段 SVG 源码转换成「一个 React 图标组件」的模块代码。
 *
 * @throws SVG 不是合法 XML、根元素不是 `<svg>`、或缺少可用的 `viewBox` 时抛错 ——
 *   构建期失败比产出一个歪掉的图标好。
 */
export function convertSvgToComponent(source: string, options: ConvertSvgOptions): ConvertSvgResult {
  const root = parseSvgRoot(source);
  const warnings: string[] = [];

  const viewBox = readViewBox(root);
  const prefixedIds = buildPrefixedIds(root, options.name);
  const tree = elementChildren(root).map((child) => buildNode(child, prefixedIds, warnings));

  const iconOptions: IconOptions = { viewBox };

  // 根 `<svg>` 的 fill 是「这一层默认怎么填」—— 描边型图标是 none,填充型是 currentColor。
  const rootFill = (root.getAttribute('fill') ?? '').trim();
  if (rootFill && rootFill !== 'none') {
    iconOptions.fill = rootFill;
    if (isHardcodedColor(rootFill)) {
      warnings.push(`<svg fill="${rootFill}"> 写死了颜色 —— 不会跟随明暗主题,需要的话改成 currentColor`);
    }
  }

  // 描边比例取设计稿自己的值,让 strokeWidth={3} 复现设计稿。
  const designStrokeWidth = Number.parseFloat(firstAttr(root, 'stroke-width') ?? '');
  if (Number.isFinite(designStrokeWidth) && designStrokeWidth > 0) {
    iconOptions.strokeScale = designStrokeWidth / REFERENCE_STROKE_WIDTH;
  }

  const linecap = firstAttr(root, 'stroke-linecap');
  if (linecap && LINE_CAPS.has(linecap)) iconOptions.strokeLinecap = linecap;
  const linejoin = firstAttr(root, 'stroke-linejoin');
  if (linejoin && LINE_JOINS.has(linejoin)) iconOptions.strokeLinejoin = linejoin;

  return {
    code: buildModuleCode(options.name, options.factoryImport, iconOptions, tree),
    warnings,
  };
}

/** 解析 SVG,返回根 `<svg>` 元素。 */
function parseSvgRoot(source: string): Element {
  const errors: string[] = [];
  const parser = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: (message: unknown) => errors.push(String(message)),
      fatalError: (message: unknown) => errors.push(String(message)),
    },
  });

  const document = parser.parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;

  if (!root || root.tagName !== 'svg') {
    throw new Error('不是 SVG 文件 —— 根元素不是 <svg>');
  }
  if (errors.length > 0) {
    throw new Error(`SVG 解析失败:${errors.join(' ')}`);
  }
  return root;
}

/** 读画布坐标系 —— `viewBox` 优先,其次 `width` / `height`。 */
function readViewBox(root: Element): string {
  const viewBox = (root.getAttribute('viewBox') ?? '').trim();
  if (viewBox) return viewBox.replace(/,/g, ' ').replace(/\s+/g, ' ');

  const width = Number.parseFloat(root.getAttribute('width') ?? '');
  const height = Number.parseFloat(root.getAttribute('height') ?? '');
  if (Number.isFinite(width) && Number.isFinite(height)) return `0 0 ${width} ${height}`;

  throw new Error('SVG 缺少 viewBox,width/height 也不是数字 —— 无法确定画布坐标系');
}

/**
 * 收集整棵树里的 `id`,统一加上图标名前缀。
 *
 * 不加前缀的话,两个图标里同名的 `id`(设计稿里很常见,比如渐变都叫 `a`)
 * 会在同一个页面里撞车 —— `url(#a)` 会指向另一个图标的渐变。
 */
function buildPrefixedIds(root: Element, name: string): Map<string, string> {
  const ids = new Set<string>();
  const visit = (element: Element) => {
    const id = element.getAttribute('id');
    if (id) ids.add(id);
    elementChildren(element).forEach(visit);
  };
  visit(root);

  return new Map([...ids].map((id) => [id, `${name}-${id}`]));
}

/** 把一个元素转成节点。 */
function buildNode(element: Element, ids: Map<string, string>, warnings: string[]): SvgElementNode {
  const props: Record<string, string | Record<string, string>> = {};
  const attributes = element.attributes;

  for (let index = 0; index < attributes.length; index += 1) {
    const attribute = attributes.item(index);
    if (!attribute) continue;

    const rawName = attribute.name;
    const rawValue = attribute.value;

    // 命名空间声明 React 用不上,带上会被当成未知属性。
    if (rawName === 'xmlns' || rawName.startsWith('xmlns:')) continue;

    if (rawName === 'id') {
      props.id = ids.get(rawValue) ?? rawValue;
      continue;
    }

    // 描边色由外层 <svg> 统一给(AppIcon 的 fill prop)—— 只有「明确不描边」才保留。
    if (rawName === 'stroke') {
      if (rawValue.trim() === 'none') props.stroke = 'none';
      continue;
    }

    // 描边粗细 / 线帽 / 线角同样交给外层 <svg>,保证全产品一致。
    if (INHERITED_STROKE_ATTRS.has(rawName)) continue;

    if (rawName === 'style') {
      const style = parseStyle(rawValue, ids);
      for (const [property, value] of Object.entries(style)) {
        if (isHardcodedColor(value) && (property === 'fill' || property === 'stroke')) {
          warnings.push(`<${element.tagName} style> 写死了颜色 ${value} —— 不会跟随明暗主题`);
        }
      }
      props.style = style;
      continue;
    }

    const propName = toReactPropName(rawName);
    if (!propName) continue;

    let value = rewriteReferences(rawValue, ids);
    if (propName === 'href' || propName === 'xlinkHref') {
      const referencedId = value.startsWith('#') ? ids.get(value.slice(1)) : undefined;
      if (referencedId) value = `#${referencedId}`;
    }
    if (propName === 'fill' && isHardcodedColor(value)) {
      warnings.push(`<${element.tagName} fill="${value}"> 写死了颜色 —— 不会跟随明暗主题`);
    }
    props[propName] = value;
  }

  const children: Array<SvgElementNode | string> = [
    ...elementChildren(element).map((child) => buildNode(child, ids, warnings)),
    ...textChildren(element),
  ];

  return { tag: element.tagName, props, children };
}

/** SVG 属性名 → React props 名。 */
function toReactPropName(attribute: string): string | null {
  if (attribute === 'class') return 'className';
  if (attribute === 'xmlns' || attribute.startsWith('xmlns:')) return null;
  if (attribute === 'xlink:href') return 'xlinkHref';
  if (attribute === 'xml:space') return 'xmlSpace';
  if (attribute === 'xml:lang') return 'xmlLang';
  if (PASSTHROUGH_ATTR_PREFIXES.some((prefix) => attribute.startsWith(prefix))) return attribute;
  if (!attribute.includes('-')) return attribute;
  return attribute.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** `style="fill:red;stroke:none"` → `{ fill: 'red', stroke: 'none' }`。 */
function parseStyle(value: string, ids: Map<string, string>): Record<string, string> {
  const style: Record<string, string> = {};
  for (const chunk of value.split(';')) {
    const separator = chunk.indexOf(':');
    if (separator < 0) continue;

    const property = chunk.slice(0, separator).trim();
    const propertyValue = chunk.slice(separator + 1).trim();
    if (!property || !propertyValue) continue;

    style[toStylePropertyName(property)] = rewriteReferences(propertyValue, ids);
  }
  return style;
}

/** CSS 属性名 → React style 对象里的键。 */
function toStylePropertyName(property: string): string {
  if (property.startsWith('--')) return property;
  return property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** 把 `url(#id)` 里的 id 换成加了前缀的。 */
function rewriteReferences(value: string, ids: Map<string, string>): string {
  return value.replace(/url\(\s*#([^)\s]+)\s*\)/g, (match, id: string) => {
    const mapped = ids.get(id);
    return mapped ? `url(#${mapped})` : match;
  });
}

/** 颜色是不是写死的(不是 `none` / `currentColor` 这类关键字)。 */
function isHardcodedColor(value: string): boolean {
  return HARDCODED_COLOR.test(value.trim());
}

/** 深度优先找第一个带该属性的元素(根节点优先)。 */
function firstAttr(element: Element, name: string): string | null {
  // 用 hasAttribute 判存在 —— xmldom 的 getAttribute 对缺失的属性返回空串而不是 null。
  if (element.hasAttribute(name)) return element.getAttribute(name) ?? '';
  for (const child of elementChildren(element)) {
    const found = firstAttr(child, name);
    if (found !== null) return found;
  }
  return null;
}

/** 子元素。 */
function elementChildren(element: Element): Element[] {
  const result: Element[] = [];
  const nodes = element.childNodes;
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes.item(index);
    if (node && node.nodeType === ELEMENT_NODE) result.push(node as Element);
  }
  return result;
}

/** 文本子节点 —— `<text>` 元素里的文字要保留。 */
function textChildren(element: Element): string[] {
  const result: string[] = [];
  const nodes = element.childNodes;
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes.item(index);
    if (!node) continue;
    if (node.nodeType !== TEXT_NODE && node.nodeType !== CDATA_SECTION_NODE) continue;
    const text = (node.nodeValue ?? '').trim();
    if (text) result.push(text);
  }
  return result;
}

/** 生成模块代码。 */
function buildModuleCode(
  name: string,
  factoryImport: string,
  iconOptions: IconOptions,
  tree: SvgElementNode[]
): string {
  const body = tree.length > 0 ? tree.map((node) => `  ${emitNode(node)}`).join(',\n') : '  null';

  return [
    "import React from 'react';",
    `import { createCustomIcon } from '${factoryImport}';`,
    '',
    `export default createCustomIcon(${JSON.stringify(name)}, ${serializeOptions(iconOptions)}, () => (`,
    body,
    '));',
    '',
  ].join('\n');
}

/** 生成 `React.createElement(...)` 调用。 */
function emitNode(node: SvgElementNode): string {
  const args: string[] = [JSON.stringify(node.tag)];
  if (Object.keys(node.props).length > 0) args.push(serializeProps(node.props));
  for (const child of node.children) {
    args.push(typeof child === 'string' ? JSON.stringify(child) : emitNode(child));
  }
  return `React.createElement(${args.join(', ')})`;
}

/** 序列化 props 对象。 */
function serializeProps(props: Record<string, string | Record<string, string>>): string {
  const parts = Object.entries(props).map(([key, value]) => {
    if (typeof value === 'string') return `${JSON.stringify(key)}: ${JSON.stringify(value)}`;
    const inner = Object.entries(value)
      .map(([styleKey, styleValue]) => `${JSON.stringify(styleKey)}: ${JSON.stringify(styleValue)}`)
      .join(', ');
    return `${JSON.stringify(key)}: { ${inner} }`;
  });
  return `{ ${parts.join(', ')} }`;
}

/** 序列化 `createCustomIcon` 的 options。 */
function serializeOptions(options: IconOptions): string {
  const parts = [`viewBox: ${JSON.stringify(options.viewBox)}`];
  if (options.fill) parts.push(`fill: ${JSON.stringify(options.fill)}`);
  if (options.strokeLinecap) parts.push(`strokeLinecap: ${JSON.stringify(options.strokeLinecap)}`);
  if (options.strokeLinejoin) parts.push(`strokeLinejoin: ${JSON.stringify(options.strokeLinejoin)}`);
  if (options.strokeScale !== undefined) parts.push(`strokeScale: ${options.strokeScale}`);
  return `{ ${parts.join(', ')} }`;
}
