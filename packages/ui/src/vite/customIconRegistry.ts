/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 定制图标注册表 —— 扫 `icons/svg/` 目录自动生成。
 *
 * 为什么生成文件,而不是 `import.meta.glob`
 * ==========================================
 * `import.meta.glob` 的返回类型写死了是 `Record<string, T>` —— key 是 `string`,
 * 不是字面量。于是 `AppIconName = keyof typeof ICON_MAP` 会从
 *
 * ```ts
 * type AppIconName = 'plus' | 'delete' | 'star-badge'
 * ```
 *
 * 塌成 `string`,`<AppIcon name='plsu' />` 编译期就不再报错 —— 全仓库几千处
 * `<AppIcon name='...' />` 的拼写保护全没了。
 *
 * 生成成**真实的 `.ts` 文件**就绕开了这个问题:TS 读到的是字面量 key,
 * 联合类型保得住,新增图标也不用手改 `ICON_MAP`。
 *
 * 代价:仓库里多一个生成文件,必须与 `svg/` 目录同步 ——
 * `aionuiSvgIconPlugin` 在 dev server / 构建启动时重写它,测试里有一道守卫盯着。
 */
import fs from 'node:fs';
import path from 'node:path';

/** 生成的文件名 —— 放在 `icons/` 目录下。 */
export const CUSTOM_ICON_REGISTRY_FILENAME = 'svg.generated.ts';

/** SVG 源目录名(相对 `icons/`)。 */
const SVG_DIRECTORY_NAME = 'svg';

/**
 * 文件名前缀 `_` = **不自动登记**。
 *
 * 留给「只想用这个 SVG、不想进全局映射表」的场景 —— 比如测试样例。
 */
const IGNORED_NAME_PREFIX = '_';

/** `icons/` 目录相对仓库根的路径片段 —— 用来从配置文件反推 `icons/` 在哪。 */
const ICONS_DIRECTORY_SEGMENTS = ['packages', 'ui', 'src', 'components', 'icons'];

/** 一个自动登记的定制图标。 */
export type CustomIconEntry = {
  /** 语义名 —— 文件名去掉扩展名。 */
  name: string;
  /** SVG 文件名。 */
  fileName: string;
};

/**
 * 扫 SVG 目录,返回要自动登记的图标。
 *
 * 规则:
 * - 只认 `.svg` 文件(目录里的其他文件 —— 比如 README —— 忽略);
 * - 文件名以 `_` 开头的**不登记**(见 `IGNORED_NAME_PREFIX`);
 * - 结果按名字排序 —— 生成的文件内容稳定,不会因为读目录顺序不同而抖动。
 */
export function scanCustomIcons(svgDirectory: string): CustomIconEntry[] {
  if (!fs.existsSync(svgDirectory)) return [];

  const entries: CustomIconEntry[] = [];
  for (const fileName of fs.readdirSync(svgDirectory)) {
    if (!fileName.toLowerCase().endsWith('.svg')) continue;

    const name = fileName.slice(0, -'.svg'.length);
    if (!name || name.startsWith(IGNORED_NAME_PREFIX)) continue;

    entries.push({ name, fileName });
  }

  return entries.toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * 生成注册表文件的文本。
 *
 * 生成的代码形如:
 *
 * ```ts
 * import StarBadgeIcon from './svg/star-badge.svg?component';
 *
 * export const CUSTOM_ICON_MAP = {
 *   'star-badge': StarBadgeIcon,
 * } as const;
 * ```
 *
 * 输出必须是 **oxfmt 格式化后的样子** —— 否则 `bun run format` 会改它、
 * 下次构建又改回去,文件在两次状态之间来回抖。
 */
export function renderCustomIconRegistry(entries: CustomIconEntry[]): string {
  const identifiers = createIdentifiers(entries);

  const lines: string[] = [
    '/**',
    ' * @license',
    ' * Copyright 2026 AionUi (aionui.com)',
    ' * SPDX-License-Identifier: Apache-2.0',
    ' */',
    '',
    '/**',
    ' * 定制图标注册表 —— **自动生成,不要手改**。',
    ' *',
    ` * 源目录:\`${SVG_DIRECTORY_NAME}/\`(文件名 = 语义名)`,
    ' * 生成者:`aionuiSvgIconPlugin` —— dev server / 构建启动时重写。',
    ' *',
    ' * 要新增图标:把 SVG 丢进 `svg/` 目录就行,不用改这个文件。',
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

/** 合法 JS 标识符 —— 合法的话 oxfmt 的 `quoteProps: "as-needed"` 会把引号去掉。 */
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * 渲染对象键。
 *
 * 必须与 oxfmt 的 `quoteProps: "as-needed"` 一致:合法标识符不加引号,
 * 其余加单引号 —— 否则 `bun run format` 会改这个文件、下次构建又改回去,
 * 文件在两个状态之间来回抖。
 */
function renderKey(name: string): string {
  if (IDENTIFIER_PATTERN.test(name)) return name;
  return `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * 重新生成注册表文件 —— **内容有变化才写盘**。
 *
 * 只在变化时写:dev server 盯着这个文件,内容不变就不该产生一次无意义的 HMR。
 *
 * 写盘是**原子**的(先写临时文件再改名):主应用与三个微应用的 dev server 会同时
 * 盯着同一个目录,直接覆盖写可能让另一个进程读到写了一半的内容。
 */
export function writeCustomIconRegistry(iconsDirectory: string): { changed: boolean; filePath: string } {
  const filePath = path.join(iconsDirectory, CUSTOM_ICON_REGISTRY_FILENAME);
  const content = renderCustomIconRegistry(scanCustomIcons(customIconDirectory(iconsDirectory)));

  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (existing === content) return { changed: false, filePath };

  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, content, 'utf8');
  fs.renameSync(temporaryPath, filePath);

  return { changed: true, filePath };
}

/** SVG 源目录的绝对路径。 */
export function customIconDirectory(iconsDirectory: string): string {
  return path.join(iconsDirectory, SVG_DIRECTORY_NAME);
}

/**
 * 这个文件是不是「自动登记的定制图标」。
 *
 * dev server 监听目录变动时用它过滤 —— 只认 `svg/` 目录下的 `.svg`,
 * 注册表文件自己、README 之类的都不算。
 */
export function isCustomIconFile(iconsDirectory: string, filePath: string): boolean {
  const relative = path.relative(customIconDirectory(iconsDirectory), filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return relative.toLowerCase().endsWith('.svg');
}

/**
 * 从一个目录往上找 `packages/ui/src/components/icons`。
 *
 * 插件自己**不知道自己的文件在哪** —— Vite 打包配置文件时会把相对 import 内联进来,
 * 插件里的 `__dirname` 变成的是**配置文件**的目录。所以只能从调用方给的位置反推:
 * 配置文件所在目录(主应用 / 三个微应用 / vitest 都在仓库内)往上走一定能找到。
 *
 * 找不到就返回 `null` —— 插件照常工作,只是不生成注册表。
 */
export function findIconsDirectory(startDirectory: string): string | null {
  let directory = path.resolve(startDirectory);

  for (;;) {
    const candidate = path.join(directory, ...ICONS_DIRECTORY_SEGMENTS);
    if (fs.existsSync(path.join(candidate, SVG_DIRECTORY_NAME))) return candidate;

    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

/** 为每个图标生成一个合法且唯一的 JS 标识符(import 时的变量名)。 */
function createIdentifiers(entries: CustomIconEntry[]): string[] {
  const used = new Set<string>();

  return entries.map((entry) => {
    const base = toIdentifier(entry.name);
    let identifier = base;
    let counter = 2;

    // `star-badge` 与 `star_badge` 规范化后同名 —— 加后缀避免重复声明。
    while (used.has(identifier)) {
      identifier = `${base}${counter}`;
      counter += 1;
    }

    used.add(identifier);
    return identifier;
  });
}

/** `star-badge` → `StarBadgeIcon`;`3d-cube` → `_3dCubeIcon`(标识符不能以数字开头)。 */
function toIdentifier(name: string): string {
  const pascal = name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const safe = pascal || 'Icon';
  const prefixed = /^[0-9]/.test(safe) ? `_${safe}` : safe;
  return `${prefixed}Icon`;
}
