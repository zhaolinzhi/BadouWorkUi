// packages/desktop/electron.vite.config.ts
import { defineConfig as defineConfig2, externalizeDepsPlugin } from 'electron-vite';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import UnoCSS from 'unocss/vite';

// uno.config.ts
import { defineConfig, transformerDirectives, transformerVariantGroup } from 'unocss';

// packages/desktop/src/renderer/styles/uno-tokens.ts
import { presetExtra } from 'unocss-preset-extra';
import { presetMini, presetWind3 } from 'unocss';
var textColors = {
  't-primary': 'var(--text-primary)',
  't-secondary': 'var(--text-secondary)',
  't-tertiary': 'var(--bg-6)',
  't-disabled': 'var(--text-disabled)',
};
var semanticColors = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
};
var backgroundColors = {
  base: 'var(--bg-base)',
  1: 'var(--bg-1)',
  2: 'var(--bg-2)',
  3: 'var(--bg-3)',
  4: 'var(--bg-4)',
  5: 'var(--bg-5)',
  6: 'var(--bg-6)',
  8: 'var(--bg-8)',
  9: 'var(--bg-9)',
  10: 'var(--bg-10)',
  hover: 'var(--bg-hover)',
  active: 'var(--bg-active)',
};
var borderColors = {
  'b-base': 'var(--border-base)',
  'b-light': 'var(--border-light)',
  'b-1': 'var(--bg-3)',
  'b-2': 'var(--bg-4)',
  'b-3': 'var(--bg-5)',
};
var brandColors = {
  brand: 'var(--brand)',
  'brand-light': 'var(--brand-light)',
  'brand-hover': 'var(--brand-hover)',
};
var aouColors = {
  aou: {
    1: 'var(--aou-1)',
    2: 'var(--aou-2)',
    3: 'var(--aou-3)',
    4: 'var(--aou-4)',
    5: 'var(--aou-5)',
    6: 'var(--aou-6)',
    7: 'var(--aou-7)',
    8: 'var(--aou-8)',
    9: 'var(--aou-9)',
    10: 'var(--aou-10)',
  },
};
var componentColors = {
  'message-user': 'var(--message-user-bg)',
  'message-tips': 'var(--message-tips-bg)',
  'workspace-btn': 'var(--workspace-btn-bg)',
};
var specialColors = {
  fill: 'var(--fill)',
  inverse: 'var(--inverse)',
};
var sharedPresets = () => [presetMini(), presetExtra(), presetWind3()];
var sharedRules = () => [
  // Arco Design 官方文字颜色 text-1 到 text-4
  [/^text-([1-4])$/, ([, d]) => ({ color: `var(--color-text-${d})` })],
  // Arco Design 官方填充色 fill-1 到 fill-4
  [/^bg-fill-([1-4])$/, ([, d]) => ({ 'background-color': `var(--color-fill-${d})` })],
  // Arco Design 官方边框色 border-1 到 border-4
  [/^border-arco-([1-4])$/, ([, d]) => ({ 'border-color': `var(--color-border-${d})` })],
  // Arco Design 浅色系 primary/success/warning/danger/link
  [
    /^bg-(primary|success|warning|danger|link)-light-([1-4])$/,
    ([, color, d]) => ({ 'background-color': `var(--color-${color}-light-${d})` }),
  ],
  // Arco Design 官方色阶 1-9
  [
    /^(bg|text|border)-(primary|success|warning|danger)-([1-9])$/,
    ([, prefix, color, d]) => {
      const prop = prefix === 'bg' ? 'background-color' : prefix === 'text' ? 'color' : 'border-color';
      return { [prop]: `rgb(var(--${color}-${d}))` };
    },
  ],
  ['bg-color-white', { 'background-color': 'var(--color-white)' }],
  ['text-color-white', { color: 'var(--color-white)' }],
  ['bg-color-black', { 'background-color': 'var(--color-black)' }],
  ['text-color-black', { color: 'var(--color-black)' }],
  ['bg-popup', { 'background-color': 'var(--color-bg-popup)' }],
  // 项目自定义颜色
  ['bg-dialog-fill-0', { 'background-color': 'var(--dialog-fill-0)' }],
  ['text-0', { color: 'var(--text-0)' }],
  ['text-white', { color: 'var(--text-white)' }],
  ['bg-fill-0', { 'background-color': 'var(--fill-0)' }],
  ['bg-fill-white-to-black', { 'background-color': 'var(--fill-white-to-black)' }],
  ['border-special', { 'border-color': 'var(--border-special)' }],
  ['animate-wiggle', { animation: 'wiggle 3s ease-in-out infinite' }],
];
var sharedShortcuts = {
  'flex-center': 'flex items-center justify-center',
};
var sharedTheme = {
  colors: {
    ...textColors,
    ...semanticColors,
    ...backgroundColors,
    ...borderColors,
    ...brandColors,
    ...aouColors,
    ...componentColors,
    ...specialColors,
  },
  fontFamily: {
    mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, "Cascadia Code", "Roboto Mono", Consolas, "Liberation Mono", monospace',
  },
};

// uno.config.ts
var uno_config_default = defineConfig({
  presets: sharedPresets(),
  transformers: [transformerVariantGroup(), transformerDirectives({ enforce: 'pre' })],
  /**
   * UnoCSS 虚拟模块前缀 —— shell 与三个微应用必须**各不相同**。
   *
   * 默认值 `__uno` 会让四个应用的虚拟模块 id 全都叫 `/__uno.css`;而 qiankun 的
   * 微应用与 shell 共用同一个 document,Vite 客户端又会把 DOM 里已有的
   * `<style data-vite-dev-id>` 标签反向认领进自己的 map,于是后加载的微应用会
   * **原地覆盖 shell 的 UnoCSS 产物**,shell 的工具类全部失效。
   *
   * 完整原理见 `packages/desktop/src/renderer/styles/uno-tokens.ts` 顶部注释。
   */
  virtualModulePrefix: '__uno_shell',
  content: {
    pipeline: {
      // Use RegExp instead of glob strings so patterns match against absolute
      // module IDs regardless of the Vite root directory.  electron-vite sets
      // the renderer root to packages/desktop/src/renderer/, which causes glob patterns like
      // 'packages/desktop/src/**/*.tsx' to resolve to the wrong nested path.
      include: [/\.[jt]sx?($|\?)/, /\.vue($|\?)/, /\.css($|\?)/],
      exclude: [/[\\/]node_modules[\\/]/, /\.html($|\?)/],
    },
  },
  rules: sharedRules(),
  // Preflights - Global base styles 全局基础样式
  preflights: [
    {
      getCSS: () => `
        * {
          /* Set default text color to follow theme \u6240\u6709\u5143\u7D20\u9ED8\u8BA4\u4F7F\u7528\u4E3B\u9898\u6587\u5B57\u989C\u8272 */
          color: inherit;
        }
        /*
         * \u8FB9\u6846\u57FA\u7EBF\uFF08\u5BF9\u9F50 Tailwind Preflight\uFF09\uFF1A\u6240\u6709\u5143\u7D20\u9ED8\u8BA4 border-width:0 + border-style:solid
         * + border-color:transparent\u3002
         *
         * \u4E24\u4E2A\u95EE\u9898\u4E00\u8D77\u6CBB\uFF1A
         * 1) \u5E7D\u7075\u6846\uFF1AUnoCSS \u7684 \`border-solid\` \u628A\u56DB\u8FB9\u90FD\u8BBE solid\uFF0C\u800C\u5355\u8FB9\u5DE5\u5177\u7C7B\uFF08border-l/border-b\u2026\uFF09
         *    \u53EA\u8BBE\u81EA\u5DF1\u90A3\u6761\u8FB9\u7684\u5BBD\u5EA6\uFF0C\u5176\u4F59\u4E09\u8FB9\u56DE\u9000\u5230 CSS \u521D\u59CB medium(\u22481.5px) \u5E76\u56E0 solid \u663E\u5F62\uFF0C\u753B\u51FA\u6574\u6846\u3002
         *    \u5BBD\u5EA6\u57FA\u7EBF\u5F52\u96F6\u540E\uFF0C\u5355\u8FB9\u7C7B\u53EA\u753B\u5B83\u81EA\u5DF1\u90A3\u6761\u7EBF\u3002
         * 2) \u9ED1\u8FB9\uFF1A\u5F88\u591A\u5143\u7D20\u53EA\u5199\u4E86 \`border\`/\`border-b\` \u5374\u6CA1\u5199\u989C\u8272\u7C7B\uFF08\u6216\u5199\u4E86\u65E0\u6548\u7684\u989C\u8272\u7C7B\uFF09\uFF0C\u5176
         *    border-color \u56DE\u9000\u5230 CSS \u521D\u59CB\u503C \`currentColor\`\uFF08=\u6587\u5B57\u8272=\u6DF1\uFF09\u3002\u4EE5\u524D border-style \u521D\u59CB\u4E3A
         *    none \u4E0D\u663E\u5F62\uFF1B\u4E00\u65E6\u5168\u5C40\u8BBE solid \u5C31\u5168\u53D8\u9ED1\u7EBF\u3002\u628A\u989C\u8272\u57FA\u7EBF\u8BBE\u4E3A transparent\uFF1A\u6CA1\u663E\u5F0F\u6307\u5B9A\u989C\u8272\u7684
         *    \u8FB9\u6846\u4FDD\u6301\u4E0D\u53EF\u89C1\uFF08\u4E0E\u6539\u52A8\u524D\u4E00\u81F4\uFF09\uFF0C\u663E\u5F0F border-base \u7B49\u4ECD\u6B63\u5E38\u663E\u793A\u3002
         */
        *,
        ::before,
        ::after {
          border-width: 0;
          border-style: solid;
          border-color: transparent;
        }
        @keyframes wiggle {
          0%, 20%, 100% { transform: rotate(0deg); }
          4% { transform: rotate(8deg); }
          8% { transform: rotate(-8deg); }
          12% { transform: rotate(6deg); }
          16% { transform: rotate(-4deg); }
        }
      `,
    },
  ],
  shortcuts: sharedShortcuts,
  theme: sharedTheme,
});

// packages/desktop/electron.vite.config.ts
import { viteStaticCopy } from 'vite-plugin-static-copy';

// packages/ui/src/vite/globalComponentsPlugin.ts
import ts from 'typescript';
var GLOBAL_COMPONENT_NAMES = ['AppIcon', 'IconButton'];
var GLOBAL_COMPONENT_SOURCE = '@aionui/ui';
function injectGlobalComponentImports(code, options = {}) {
  const source = options.source ?? GLOBAL_COMPONENT_SOURCE;
  const candidates = (options.components ?? GLOBAL_COMPONENT_NAMES).filter((name) => code.includes(name));
  if (candidates.length === 0) return code;
  const sourceFile = ts.createSourceFile('module.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const usedTags = collectJsxTagNames(sourceFile);
  const boundNames = collectModuleBindings(sourceFile);
  const missing = candidates.filter((name) => usedTags.has(name) && !boundNames.has(name));
  if (missing.length === 0) return code;
  const importStatement = `import { ${missing.join(', ')} } from '${source}';
`;
  const insertAt = findImportInsertPosition(sourceFile, code);
  return code.slice(0, insertAt) + importStatement + code.slice(insertAt);
}
function collectJsxTagNames(sourceFile) {
  const names = /* @__PURE__ */ new Set();
  const visit = (node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = node.tagName;
      if (ts.isIdentifier(tagName)) names.add(tagName.text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return names;
}
function collectModuleBindings(sourceFile) {
  const names = /* @__PURE__ */ new Set();
  const addBindingName = (name) => {
    if (ts.isIdentifier(name)) {
      names.add(name.text);
      return;
    }
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) addBindingName(element.name);
    }
  };
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (!clause) continue;
      if (clause.name) names.add(clause.name.text);
      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          names.add(clause.namedBindings.name.text);
        } else {
          for (const element of clause.namedBindings.elements) names.add(element.name.text);
        }
      }
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) addBindingName(declaration.name);
      continue;
    }
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (statement.name) names.add(statement.name.text);
      continue;
    }
    if (ts.isEnumDeclaration(statement) || ts.isModuleDeclaration(statement)) {
      names.add(statement.name.text);
    }
  }
  return names;
}
function findImportInsertPosition(sourceFile, code) {
  let position = 0;
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) position = statement.end;
  }
  if (position > 0) {
    const lineBreak = /^\r?\n/.exec(code.slice(position));
    if (lineBreak) position += lineBreak[0].length;
    return position;
  }
  const first = sourceFile.statements[0];
  return first ? first.getStart(sourceFile) : 0;
}
function aionuiGlobalComponentsPlugin(options = {}) {
  return {
    name: 'aionui-global-components',
    // 必须早于 esbuild / babel 的 JSX 转换 —— 那之后源码里就没有 JSX 标签了。
    enforce: 'pre',
    transform(code, id) {
      const [filePath] = id.split('?');
      if (!/\.[jt]sx$/.test(filePath)) return null;
      if (filePath.includes('node_modules')) return null;
      const transformed = injectGlobalComponentImports(code, options);
      if (transformed === code) return null;
      return { code: transformed, map: null };
    },
  };
}

// packages/ui/src/vite/svgIconPlugin.ts
import fs2 from 'node:fs';
import path2 from 'node:path';

// packages/ui/src/vite/customIconRegistry.ts
import fs from 'node:fs';
import path from 'node:path';
var CUSTOM_ICON_REGISTRY_FILENAME = 'svg.generated.ts';
var SVG_DIRECTORY_NAME = 'svg';
var IGNORED_NAME_PREFIX = '_';
var ICONS_DIRECTORY_SEGMENTS = ['packages', 'ui', 'src', 'components', 'icons'];
function scanCustomIcons(svgDirectory) {
  if (!fs.existsSync(svgDirectory)) return [];
  const entries = [];
  for (const fileName of fs.readdirSync(svgDirectory)) {
    if (!fileName.toLowerCase().endsWith('.svg')) continue;
    const name = fileName.slice(0, -'.svg'.length);
    if (!name || name.startsWith(IGNORED_NAME_PREFIX)) continue;
    entries.push({ name, fileName });
  }
  return entries.toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
function renderCustomIconRegistry(entries) {
  const identifiers = createIdentifiers(entries);
  const lines = [
    '/**',
    ' * @license',
    ' * Copyright 2026 AionUi (aionui.com)',
    ' * SPDX-License-Identifier: Apache-2.0',
    ' */',
    '',
    '/**',
    ' * \u5B9A\u5236\u56FE\u6807\u6CE8\u518C\u8868 \u2014\u2014 **\u81EA\u52A8\u751F\u6210,\u4E0D\u8981\u624B\u6539**\u3002',
    ' *',
    ` * \u6E90\u76EE\u5F55:\`${SVG_DIRECTORY_NAME}/\`(\u6587\u4EF6\u540D = \u8BED\u4E49\u540D)`,
    ' * \u751F\u6210\u8005:`aionuiSvgIconPlugin` \u2014\u2014 dev server / \u6784\u5EFA\u542F\u52A8\u65F6\u91CD\u5199\u3002',
    ' *',
    ' * \u8981\u65B0\u589E\u56FE\u6807:\u628A SVG \u4E22\u8FDB `svg/` \u76EE\u5F55\u5C31\u884C,\u4E0D\u7528\u6539\u8FD9\u4E2A\u6587\u4EF6\u3002',
    ' */',
    '',
  ];
  for (const [index, entry] of entries.entries()) {
    lines.push(`import ${identifiers[index]} from './${SVG_DIRECTORY_NAME}/${entry.fileName}?component';`);
  }
  if (entries.length > 0) lines.push('');
  if (entries.length === 0) {
    lines.push('export const CUSTOM_ICON_MAP = {} as const;');
  } else {
    lines.push('export const CUSTOM_ICON_MAP = {');
    for (const [index, entry] of entries.entries()) {
      lines.push(`  ${renderKey(entry.name)}: ${identifiers[index]},`);
    }
    lines.push('} as const;');
  }
  lines.push('');
  return lines.join('\n');
}
var IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function renderKey(name) {
  if (IDENTIFIER_PATTERN.test(name)) return name;
  return `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
function writeCustomIconRegistry(iconsDirectory) {
  const filePath = path.join(iconsDirectory, CUSTOM_ICON_REGISTRY_FILENAME);
  const content = renderCustomIconRegistry(scanCustomIcons(customIconDirectory(iconsDirectory)));
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (existing === content) return { changed: false, filePath };
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, content, 'utf8');
  fs.renameSync(temporaryPath, filePath);
  return { changed: true, filePath };
}
function customIconDirectory(iconsDirectory) {
  return path.join(iconsDirectory, SVG_DIRECTORY_NAME);
}
function isCustomIconFile(iconsDirectory, filePath) {
  const relative = path.relative(customIconDirectory(iconsDirectory), filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return relative.toLowerCase().endsWith('.svg');
}
function findIconsDirectory(startDirectory) {
  let directory = path.resolve(startDirectory);
  for (;;) {
    const candidate = path.join(directory, ...ICONS_DIRECTORY_SEGMENTS);
    if (fs.existsSync(path.join(candidate, SVG_DIRECTORY_NAME))) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}
function createIdentifiers(entries) {
  const used = /* @__PURE__ */ new Set();
  return entries.map((entry) => {
    const base = toIdentifier(entry.name);
    let identifier = base;
    let counter = 2;
    while (used.has(identifier)) {
      identifier = `${base}${counter}`;
      counter += 1;
    }
    used.add(identifier);
    return identifier;
  });
}
function toIdentifier(name) {
  const pascal = name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  const safe = pascal || 'Icon';
  const prefixed = /^[0-9]/.test(safe) ? `_${safe}` : safe;
  return `${prefixed}Icon`;
}

// packages/ui/src/vite/svgToReact.ts
import { DOMParser } from '@xmldom/xmldom';
var INHERITED_STROKE_ATTRS = /* @__PURE__ */ new Set(['stroke-width', 'stroke-linecap', 'stroke-linejoin']);
var PASSTHROUGH_ATTR_PREFIXES = ['data-', 'aria-'];
var HARDCODED_COLOR = /^(#|rgb\(|rgba\(|hsl\(|hsla\()/i;
var REFERENCE_STROKE_WIDTH = 3;
var ELEMENT_NODE = 1;
var TEXT_NODE = 3;
var CDATA_SECTION_NODE = 4;
var LINE_CAPS = /* @__PURE__ */ new Set(['butt', 'round', 'square']);
var LINE_JOINS = /* @__PURE__ */ new Set(['miter', 'round', 'bevel']);
function convertSvgToComponent(source, options) {
  const root = parseSvgRoot(source);
  const warnings = [];
  const viewBox = readViewBox(root);
  const prefixedIds = buildPrefixedIds(root, options.name);
  const tree = elementChildren(root).map((child) => buildNode(child, prefixedIds, warnings));
  const iconOptions = { viewBox };
  const rootFill = (root.getAttribute('fill') ?? '').trim();
  if (rootFill && rootFill !== 'none') {
    iconOptions.fill = rootFill;
    if (isHardcodedColor(rootFill)) {
      warnings.push(
        `<svg fill="${rootFill}"> \u5199\u6B7B\u4E86\u989C\u8272 \u2014\u2014 \u4E0D\u4F1A\u8DDF\u968F\u660E\u6697\u4E3B\u9898,\u9700\u8981\u7684\u8BDD\u6539\u6210 currentColor`
      );
    }
  }
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
function parseSvgRoot(source) {
  const errors = [];
  const parser = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: (message) => errors.push(String(message)),
      fatalError: (message) => errors.push(String(message)),
    },
  });
  const document = parser.parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;
  if (!root || root.tagName !== 'svg') {
    throw new Error('\u4E0D\u662F SVG \u6587\u4EF6 \u2014\u2014 \u6839\u5143\u7D20\u4E0D\u662F <svg>');
  }
  if (errors.length > 0) {
    throw new Error(`SVG \u89E3\u6790\u5931\u8D25:${errors.join(' ')}`);
  }
  return root;
}
function readViewBox(root) {
  const viewBox = (root.getAttribute('viewBox') ?? '').trim();
  if (viewBox) return viewBox.replace(/,/g, ' ').replace(/\s+/g, ' ');
  const width = Number.parseFloat(root.getAttribute('width') ?? '');
  const height = Number.parseFloat(root.getAttribute('height') ?? '');
  if (Number.isFinite(width) && Number.isFinite(height)) return `0 0 ${width} ${height}`;
  throw new Error(
    'SVG \u7F3A\u5C11 viewBox,width/height \u4E5F\u4E0D\u662F\u6570\u5B57 \u2014\u2014 \u65E0\u6CD5\u786E\u5B9A\u753B\u5E03\u5750\u6807\u7CFB'
  );
}
function buildPrefixedIds(root, name) {
  const ids = /* @__PURE__ */ new Set();
  const visit = (element) => {
    const id = element.getAttribute('id');
    if (id) ids.add(id);
    elementChildren(element).forEach(visit);
  };
  visit(root);
  return new Map([...ids].map((id) => [id, `${name}-${id}`]));
}
function buildNode(element, ids, warnings) {
  const props = {};
  const attributes = element.attributes;
  for (let index = 0; index < attributes.length; index += 1) {
    const attribute = attributes.item(index);
    if (!attribute) continue;
    const rawName = attribute.name;
    const rawValue = attribute.value;
    if (rawName === 'xmlns' || rawName.startsWith('xmlns:')) continue;
    if (rawName === 'id') {
      props.id = ids.get(rawValue) ?? rawValue;
      continue;
    }
    if (rawName === 'stroke') {
      if (rawValue.trim() === 'none') props.stroke = 'none';
      continue;
    }
    if (INHERITED_STROKE_ATTRS.has(rawName)) continue;
    if (rawName === 'style') {
      const style = parseStyle(rawValue, ids);
      for (const [property, value2] of Object.entries(style)) {
        if (isHardcodedColor(value2) && (property === 'fill' || property === 'stroke')) {
          warnings.push(
            `<${element.tagName} style> \u5199\u6B7B\u4E86\u989C\u8272 ${value2} \u2014\u2014 \u4E0D\u4F1A\u8DDF\u968F\u660E\u6697\u4E3B\u9898`
          );
        }
      }
      props.style = style;
      continue;
    }
    const propName = toReactPropName(rawName);
    if (!propName) continue;
    let value = rewriteReferences(rawValue, ids);
    if (propName === 'href' || propName === 'xlinkHref') {
      const referencedId = value.startsWith('#') ? ids.get(value.slice(1)) : void 0;
      if (referencedId) value = `#${referencedId}`;
    }
    if (propName === 'fill' && isHardcodedColor(value)) {
      warnings.push(
        `<${element.tagName} fill="${value}"> \u5199\u6B7B\u4E86\u989C\u8272 \u2014\u2014 \u4E0D\u4F1A\u8DDF\u968F\u660E\u6697\u4E3B\u9898`
      );
    }
    props[propName] = value;
  }
  const children = [
    ...elementChildren(element).map((child) => buildNode(child, ids, warnings)),
    ...textChildren(element),
  ];
  return { tag: element.tagName, props, children };
}
function toReactPropName(attribute) {
  if (attribute === 'class') return 'className';
  if (attribute === 'xmlns' || attribute.startsWith('xmlns:')) return null;
  if (attribute === 'xlink:href') return 'xlinkHref';
  if (attribute === 'xml:space') return 'xmlSpace';
  if (attribute === 'xml:lang') return 'xmlLang';
  if (PASSTHROUGH_ATTR_PREFIXES.some((prefix) => attribute.startsWith(prefix))) return attribute;
  if (!attribute.includes('-')) return attribute;
  return attribute.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}
function parseStyle(value, ids) {
  const style = {};
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
function toStylePropertyName(property) {
  if (property.startsWith('--')) return property;
  return property.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}
function rewriteReferences(value, ids) {
  return value.replace(/url\(\s*#([^)\s]+)\s*\)/g, (match, id) => {
    const mapped = ids.get(id);
    return mapped ? `url(#${mapped})` : match;
  });
}
function isHardcodedColor(value) {
  return HARDCODED_COLOR.test(value.trim());
}
function firstAttr(element, name) {
  if (element.hasAttribute(name)) return element.getAttribute(name) ?? '';
  for (const child of elementChildren(element)) {
    const found = firstAttr(child, name);
    if (found !== null) return found;
  }
  return null;
}
function elementChildren(element) {
  const result = [];
  const nodes = element.childNodes;
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes.item(index);
    if (node && node.nodeType === ELEMENT_NODE) result.push(node);
  }
  return result;
}
function textChildren(element) {
  const result = [];
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
function buildModuleCode(name, factoryImport, iconOptions, tree) {
  const body = tree.length > 0 ? tree.map((node) => `    ${emitNode(node)}`).join(',\n') : '    null';
  return [
    "import React from 'react';",
    `import { createCustomIcon } from '${factoryImport}';`,
    '',
    `export default createCustomIcon(${JSON.stringify(name)}, ${serializeOptions(iconOptions)}, () => (`,
    // 子元素必须包一层 Fragment —— 直接写成 `() => (a, b, c)` 会被当成逗号表达式,
    // 只返回最后一个元素,SVG 里其余的形状就全丢了(一个多路径的图标只剩一条线)。
    '  React.createElement(React.Fragment, null,',
    body,
    '  )',
    '));',
    '',
  ].join('\n');
}
function emitNode(node) {
  const args = [JSON.stringify(node.tag)];
  if (Object.keys(node.props).length > 0) args.push(serializeProps(node.props));
  for (const child of node.children) {
    args.push(typeof child === 'string' ? JSON.stringify(child) : emitNode(child));
  }
  return `React.createElement(${args.join(', ')})`;
}
function serializeProps(props) {
  const parts = Object.entries(props).map(([key, value]) => {
    if (typeof value === 'string') return `${JSON.stringify(key)}: ${JSON.stringify(value)}`;
    const inner = Object.entries(value)
      .map(([styleKey, styleValue]) => `${JSON.stringify(styleKey)}: ${JSON.stringify(styleValue)}`)
      .join(', ');
    return `${JSON.stringify(key)}: { ${inner} }`;
  });
  return `{ ${parts.join(', ')} }`;
}
function serializeOptions(options) {
  const parts = [`viewBox: ${JSON.stringify(options.viewBox)}`];
  if (options.fill) parts.push(`fill: ${JSON.stringify(options.fill)}`);
  if (options.strokeLinecap) parts.push(`strokeLinecap: ${JSON.stringify(options.strokeLinecap)}`);
  if (options.strokeLinejoin) parts.push(`strokeLinejoin: ${JSON.stringify(options.strokeLinejoin)}`);
  if (options.strokeScale !== void 0) parts.push(`strokeScale: ${options.strokeScale}`);
  return `{ ${parts.join(', ')} }`;
}

// packages/ui/src/vite/svgIconPlugin.ts
var COMPONENT_QUERY = 'component';
var FACTORY_EXTENSIONS = ['.tsx', '.ts'];
var FACTORY_SEARCH_DEPTH = 5;
function aionuiSvgIconPlugin(options = {}) {
  const factoryFileName = options.factoryFileName ?? 'customIcons';
  let iconsDirectory = options.iconsDirectory ?? null;
  return {
    name: 'aionui:svg-icon',
    // 必须早于 vite:asset —— 否则 .svg 会被当成静态资源,变成一个 URL 字符串。
    enforce: 'pre',
    configResolved(config) {
      if (iconsDirectory) return;
      const start = config.configFile ? path2.dirname(config.configFile) : config.root;
      iconsDirectory = findIconsDirectory(start);
    },
    buildStart() {
      if (!iconsDirectory) return;
      const { changed, filePath } = writeCustomIconRegistry(iconsDirectory);
      if (changed) this.info(`\u5B9A\u5236\u56FE\u6807\u6CE8\u518C\u8868\u5DF2\u66F4\u65B0:${filePath}`);
    },
    /**
     * dev server 起来之后,新增/删除 SVG 也要能自动生效 —— 不然每次加图标
     * 都得重启一遍 dev server,「丢文件就完事」就成了一句空话。
     *
     * 要显式 `watcher.add()`:SVG 目录在**工程根之外**(共享层 `packages/ui/`),
     * 而新加的文件还没进模块图,Vite 不会自动盯着它。
     */
    configureServer(server) {
      if (!iconsDirectory) return;
      const iconsDirectoryPath = iconsDirectory;
      server.watcher.add(customIconDirectory(iconsDirectoryPath));
      const regenerate = (filePath) => {
        if (!isCustomIconFile(iconsDirectoryPath, filePath)) return;
        const { changed, filePath: registryPath } = writeCustomIconRegistry(iconsDirectoryPath);
        if (!changed) return;
        server.config.logger.info(`\u5B9A\u5236\u56FE\u6807\u6CE8\u518C\u8868\u5DF2\u66F4\u65B0:${registryPath}`);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', regenerate);
      server.watcher.on('unlink', regenerate);
    },
    load(id) {
      const queryIndex = id.indexOf('?');
      if (queryIndex < 0) return null;
      if (id.slice(queryIndex + 1) !== COMPONENT_QUERY) return null;
      const filePath = id.slice(0, queryIndex);
      if (path2.extname(filePath).toLowerCase() !== '.svg') return null;
      const source = fs2.readFileSync(filePath, 'utf8');
      const name = toComponentName(path2.basename(filePath, path2.extname(filePath)));
      const factoryImport = resolveFactoryImport(filePath, factoryFileName);
      const { code, warnings } = convertSvgToComponent(source, { name, factoryImport });
      for (const warning of warnings) this.warn(warning);
      return { code, map: null };
    },
  };
}
function toComponentName(fileName) {
  return fileName.startsWith('_') ? fileName.slice(1) : fileName;
}
function resolveFactoryImport(filePath, factoryFileName) {
  const svgDirectory = path2.dirname(filePath);
  let directory = svgDirectory;
  for (let depth = 0; depth <= FACTORY_SEARCH_DEPTH; depth += 1) {
    for (const extension of FACTORY_EXTENSIONS) {
      const candidate = path2.join(directory, `${factoryFileName}${extension}`);
      if (fs2.existsSync(candidate)) {
        const relative = path2.relative(svgDirectory, candidate).split(path2.sep).join('/');
        return relative.startsWith('.') ? relative : `./${relative}`;
      }
    }
    const parent = path2.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error(
    `[aionui:svg-icon] \u627E\u4E0D\u5230 ${factoryFileName}.tsx \u2014\u2014 \u65E0\u6CD5\u628A ${filePath} \u8F6C\u6210\u56FE\u6807\u7EC4\u4EF6\u3002SVG \u6587\u4EF6\u8981\u653E\u5728 ${factoryFileName}.tsx \u6240\u5728\u76EE\u5F55\u7684\u5B50\u76EE\u5F55\u91CC\u3002`
  );
}

// packages/desktop/electron.vite.config.ts
var __electron_vite_injected_dirname =
  '/Users/zhaolinzhi/Documents/workspaces/2026/aionui/lastestui/BadouWorkUi/packages/desktop';
var rootPackageJson = JSON.parse(
  readFileSync(resolve(__electron_vite_injected_dirname, '../../package.json'), 'utf-8')
);
function buildMcpServersPlugin() {
  return {
    name: 'vite-plugin-build-mcp-servers',
    closeBundle() {
      execSync(`node "${resolve('scripts/build-mcp-servers.js')}"`, { stdio: 'inherit' });
    },
  };
}
function iconParkPlugin() {
  return {
    name: 'vite-plugin-icon-park',
    enforce: 'pre',
    transform(source, id) {
      if (!id.endsWith('.tsx') || id.includes('node_modules')) return null;
      if (!source.includes('@icon-park/react')) return null;
      const transformedSource = source.replace(
        /import\s+\{\s+([a-zA-Z, ]*)\s+\}\s+from\s+['"]@icon-park\/react['"](;?)/g,
        function (str, match) {
          if (!match) return str;
          const components = match.split(',');
          const importComponent = str.replace(match, components.map((key) => `${key} as _${key.trim()}`).join(', '));
          const hoc = `import IconParkHOC from '@renderer/components/IconParkHOC';
          ${components.map((key) => `const ${key.trim()} = IconParkHOC(_${key.trim()})`).join(';\n')}`;
          return importComponent + ';' + hoc;
        }
      );
      if (transformedSource !== source) return { code: transformedSource, map: null };
      return null;
    },
  };
}
var desktopSrcRoot = resolve('packages/desktop/src');
var rendererRoot = resolve('packages/desktop/src/renderer');
var mainAliases = {
  '@': desktopSrcRoot,
  '@common': resolve('packages/desktop/src/common'),
  '@renderer': rendererRoot,
  '@process': resolve('packages/desktop/src/process'),
  '@worker': resolve('packages/desktop/src/process/worker'),
  '@xterm/headless': resolve('packages/desktop/src/common/utils/shims/xterm-headless.ts'),
};
var electron_vite_config_default = defineConfig2(({ mode }) => {
  const isDevelopment = mode === 'development';
  const enableSentrySourceMaps =
    !isDevelopment &&
    !!process.env.SENTRY_AUTH_TOKEN &&
    (process.env.CI !== 'true' || process.env.SENTRY_UPLOAD_SOURCE_MAPS === 'true');
  const sentryReleaseName = process.env.SENTRY_RELEASE ?? `v${rootPackageJson.version}`;
  const sentryPluginOptions = {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    release: {
      name: sentryReleaseName,
    },
    errorHandler: (error) => {
      throw error;
    },
    sourcemaps: {
      filesToDeleteAfterUpload: ['./out/**/*.map'],
      rewriteSources: (source) => {
        return source.replace(/\\/g, '/').replace(/^(\.\.\/)+(packages\/desktop\/src\/)/, '$2');
      },
    },
  };
  return {
    main: {
      plugins: [
        // externalizeDepsPlugin replaces our custom getExternalDeps() + pluginExternalizeDynamicImports.
        // 'fix-path' excluded so it gets bundled inline (only 3KB).
        // '@aionui/web-host' excluded so its TS sources (which use ESM ".js" import specifiers)
        // are bundled by esbuild rather than left as `require('@aionui/web-host')`, which Node
        // cannot resolve because the package ships no compiled .js files (workspace-only).
        externalizeDepsPlugin({ exclude: ['fix-path', '@aionui/web-host'], include: ['builder-util-runtime'] }),
        ...(isDevelopment
          ? [
              {
                name: 'dev-build-mcp-servers',
                closeBundle() {
                  execSync(
                    `node "${resolve(__electron_vite_injected_dirname, '../../scripts/build-mcp-servers.js')}"`,
                    {
                      stdio: 'inherit',
                    }
                  );
                },
              },
            ]
          : []),
        ...(!isDevelopment
          ? [
              viteStaticCopy({
                structured: false,
                // electron-vite builds main process as SSR; viteStaticCopy defaults
                // to environment: "client" and silently skips non-client environments.
                environment: 'ssr',
                targets: [
                  // Use single * glob to copy top-level items (directories) with their contents intact.
                  // Using ** would flatten all nested files into the dest root.
                  { src: 'packages/desktop/src/renderer/assets/logos/*', dest: 'static/images' },
                ],
              }),
            ]
          : []),
        ...(enableSentrySourceMaps ? [sentryVitePlugin(sentryPluginOptions)] : []),
        ...(isDevelopment ? [buildMcpServersPlugin()] : []),
      ],
      resolve: { alias: mainAliases, extensions: ['.ts', '.tsx', '.js', '.json'] },
      build: {
        sourcemap: enableSentrySourceMaps ? 'hidden' : isDevelopment,
        reportCompressedSize: false,
        rollupOptions: {
          input: {
            index: resolve('packages/desktop/src/index.ts'),
            // Built-in MCP server entry points (compiled by scripts/build-mcp-servers.js via esbuild,
            // not vite — esbuild bundles all deps for self-contained execution by external node processes)
          },
          onwarn(warning, warn) {
            if (warning.code === 'EVAL') return;
            warn(warning);
          },
        },
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify(mode),
        'process.env.env': JSON.stringify(process.env.env),
        'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN ?? ''),
        // Discontinued-build fork flag (see discontinuedBuild.ts). Only AionUi's
        // final `-final` tag build sets IS_DISCONTINUED_BUILD=true in CI.
        'process.env.IS_DISCONTINUED_BUILD': JSON.stringify(process.env.IS_DISCONTINUED_BUILD === 'true'),
      },
    },
    preload: {
      // Bundle @sentry/electron/preload so its hookupIpc() runs in the preload
      // context. Externalized dependencies leave a runtime require('...') in
      // the output, which Electron's sandbox-mode preload cannot resolve from
      // node_modules (→ "module not found"). Bundling inlines the few hundred
      // bytes of IPC wiring we actually need.
      // We also bundle 'electron' itself so that `require('electron')` returns
      // the real { contextBridge, ipcRenderer } object in the preload, not
      // undefined.
      plugins: [externalizeDepsPlugin({ exclude: ['@sentry/electron', 'electron'] })],
      resolve: {
        alias: {
          '@': resolve('packages/desktop/src'),
          '@common': resolve('packages/desktop/src/common'),
        },
        extensions: ['.ts', '.tsx', '.js', '.json'],
      },
      build: {
        sourcemap: false,
        reportCompressedSize: false,
        rollupOptions: {
          input: {
            index: resolve('packages/desktop/src/preload/main.ts'),
            petPreload: resolve('packages/desktop/src/preload/petPreload.ts'),
            petHitPreload: resolve('packages/desktop/src/preload/petHitPreload.ts'),
            petConfirmPreload: resolve('packages/desktop/src/preload/petConfirmPreload.ts'),
          },
        },
      },
    },
    renderer: {
      // The renderer workspace moved under packages/desktop/src/renderer in M1.
      // Make the root explicit so Vite emits page names relative to that directory
      // instead of leaking source-relative ../../ paths into HTML asset names.
      root: rendererRoot,
      // `.env` 文件在 packages/desktop/ 下,不在 Vite 的 root(rendererRoot)里。
      // electron-vite 默认把 envDir 设成 `options.root || process.cwd()` —— CLI 没带
      // `[root]` 位置参数,所以是仓库根;那里一个 .env 都没有,于是
      // packages/desktop/.env.production / .env.development 永远读不到,里面的
      // VITE_* 变量全部失效(文档 02-config.md 2.3.1 描述的加载顺序因此从未成立)。
      // 显式指到本包目录,让它们真正生效。
      //
      // 注意优先级:Vite 里 `process.env` 高于 .env 文件 —— 所以 `bun run build:all`
      // 注入的 VITE_MICRO_APP_ENABLED=true / app://microapps 依旧盖得住这里的占位值。
      envDir: resolve(__electron_vite_injected_dirname),
      base: './',
      publicDir: resolve('public'),
      appType: 'mpa',
      server: {
        // Default to 5173; when occupied (e.g. another AionUi clone is running),
        // Vite auto-increments to the next available port.
        // electron-vite reads the actual port and sets ELECTRON_RENDERER_URL accordingly.
        port: 5173,
        // Explicit HMR host so Vite client connects directly to the Vite dev server,
        // not to the WebUI proxy server (which would reject the WebSocket and cause infinite reload).
        // Port is omitted so it automatically matches the server port.
        hmr: {
          host: 'localhost',
        },
      },
      resolve: {
        alias: {
          '@': resolve('packages/desktop/src'),
          '@common': resolve('packages/desktop/src/common'),
          '@renderer': resolve('packages/desktop/src/renderer'),
          '@process': resolve('packages/desktop/src/process'),
          '@worker': resolve('packages/desktop/src/process/worker'),
          // 主应用与三个 qiankun 微应用共用的 UI 组件层。
          // 源码级共享 —— 包内不发布构建产物,各自的 bundler 把用到的部分
          // 打进自己的 chunk(与 `@aionui/microapp-shared` 同一模式)。
          '@aionui/ui': resolve('packages/ui/src/index.ts'),
          // Force ESM version of streamdown
          streamdown: resolve('node_modules/streamdown/dist/index.js'),
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'],
        // CodeMirror relies on module-level singletons (highlighterFacet, tag
        // sets). If Vite pre-bundles two copies of @codemirror/language (one for
        // our direct import, one nested under @uiw/react-codemirror), our custom
        // markdown HighlightStyle registers on a facet the editor never reads,
        // so the source view silently falls back to near-monochrome. Dedupe the
        // singleton packages to a single physical copy. Only packages hoisted to
        // the top-level node_modules may be deduped here — @lezer/common is not
        // hoisted under bun's isolated layout, so listing it breaks the Rollup
        // production build (cannot resolve from nested @codemirror/lang-* dirs).
        dedupe: [
          'react',
          'react-dom',
          'react-router-dom',
          '@codemirror/state',
          '@codemirror/view',
          '@codemirror/language',
          '@lezer/highlight',
        ],
      },
      plugins: [
        UnoCSS(uno_config_default),
        iconParkPlugin(),
        // 全局注册 @aionui/ui 的图标 / 按钮:<AppIcon />、<IconButton /> 不用再 import。
        // enforce:'pre',要赶在 esbuild 的 JSX 转换之前 —— 之后源码里就没有 JSX 标签了。
        aionuiGlobalComponentsPlugin(),
        // `*.svg?component` 编译成图标组件 —— 定制图标放在 @aionui/ui 的 svg 目录里,
        // 构建期转成普通 React 组件,运行时零开销。
        aionuiSvgIconPlugin(),
        viteStaticCopy({
          // Vditor hardcodes requests like `${cdn}/dist/js/i18n/zh_CN.js`
          // and `${cdn}/dist/js/lute/lute.min.js`. The renderer root is
          // packages/desktop/src/renderer, so a relative `src` would be
          // resolved against that directory — which has no `node_modules`
          // (the workspace hoists vditor to the repo root). Using an absolute
          // path lets the glob find it, and the resolved `base` becomes
          // `dist`, which fileMap keys as `/vditor/dist` to match Vditor's
          // hardcoded URLs.
          //
          // On Windows, `resolve()` returns backslash separators
          // (D:\a\...\node_modules\vditor\dist), which tinyglobby treats as
          // glob escapes and matches nothing — vite-plugin-static-copy then
          // fails with "No file was found to copy". Normalize to forward
          // slashes so the absolute-path glob works on every platform.
          targets: [
            {
              src: resolve(__electron_vite_injected_dirname, '../../node_modules/vditor/dist').replace(/\\/g, '/'),
              dest: 'vditor',
            },
          ],
        }),
        ...(enableSentrySourceMaps ? [sentryVitePlugin(sentryPluginOptions)] : []),
      ],
      build: {
        target: 'es2022',
        sourcemap: enableSentrySourceMaps ? 'hidden' : isDevelopment,
        minify: !isDevelopment,
        reportCompressedSize: false,
        chunkSizeWarningLimit: 1500,
        cssCodeSplit: true,
        rollupOptions: {
          input: {
            index: resolve(rendererRoot, 'index.html'),
            pet: resolve(rendererRoot, 'pet/pet.html'),
            'pet-hit': resolve(rendererRoot, 'pet/pet-hit.html'),
            'pet-confirm': resolve(rendererRoot, 'pet/pet-confirm.html'),
          },
          external: ['node:crypto', 'crypto'],
          onwarn(warning, warn) {
            if (warning.code === 'EVAL') return;
            warn(warning);
          },
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return void 0;
              if (
                id.includes('/react-dom/') ||
                id.includes('/react/') ||
                id.includes('/@arco-design/') ||
                id.includes('/react-markdown/') ||
                id.includes('/remark-') ||
                id.includes('/rehype-') ||
                id.includes('/unified/') ||
                id.includes('/mdast-') ||
                id.includes('/hast-') ||
                id.includes('/micromark') ||
                id.includes('/react-syntax-highlighter/') ||
                id.includes('/refractor/') ||
                id.includes('/highlight.js/') ||
                id.includes('/monaco-editor/') ||
                id.includes('/@monaco-editor/') ||
                id.includes('/codemirror/') ||
                id.includes('/@codemirror/') ||
                id.includes('/katex/')
              )
                return 'vendor';
              if (id.includes('/@icon-park/')) return 'vendor-icons';
              if (id.includes('/diff2html/')) return 'vendor-diff';
              return void 0;
            },
          },
        },
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify(mode),
        'process.env.env': JSON.stringify(process.env.env),
        'process.env.AIONUI_MULTI_INSTANCE': JSON.stringify(process.env.AIONUI_MULTI_INSTANCE ?? ''),
        'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN ?? ''),
        // Inject the real AionUi version (root package.json) so renderer code
        // can show it without importing packages/desktop/package.json, which is
        // a workspace-internal placeholder frozen at "0.0.0".
        __APP_VERSION__: JSON.stringify(rootPackageJson.version),
        // Renderer-side discontinued-build flag; consumed via discontinuedBuild.ts.
        __IS_DISCONTINUED_BUILD__: JSON.stringify(process.env.IS_DISCONTINUED_BUILD === 'true'),
        global: 'globalThis',
      },
      optimizeDeps: {
        exclude: ['electron'],
        include: [
          'react',
          'react-dom',
          'react-router-dom',
          'react-i18next',
          'i18next',
          '@arco-design/web-react',
          '@icon-park/react',
          'react-markdown',
          'react-syntax-highlighter',
          'react-virtuoso',
          'classnames',
          'swr',
          'eventemitter3',
          'katex',
          'diff2html',
          'remark-gfm',
          'remark-math',
          'remark-breaks',
          'rehype-raw',
          'rehype-katex',
          // Pre-bundle the CodeMirror entry points together so they share a
          // single @codemirror/language copy (see dedupe note above); otherwise
          // the markdown source view loses its custom syntax highlighting.
          '@uiw/react-codemirror',
          '@codemirror/lang-markdown',
          '@codemirror/language',
          'vditor',
          // qiankun pulls in import-html-entry + single-spa + lodash + @babel/runtime;
          // listing it explicitly avoids the first-launch optimizeDeps stall that
          // leaves the renderer white-screening (see bug report 2026-10-15).
          'qiankun',
        ],
      },
    },
  };
});
export { electron_vite_config_default as default };
/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
