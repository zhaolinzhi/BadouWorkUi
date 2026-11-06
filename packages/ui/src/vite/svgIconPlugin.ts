/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 把 `*.svg?component` 的导入编译成 React 图标组件,并自动维护定制图标注册表。
 *
 * 用法
 * ===
 * ```ts
 * // 把 SVG 放进 packages/ui/src/components/icons/svg/ 就完事了 ——
 * // 插件会扫描该目录,生成 `icons/svg.generated.ts`,并登记进 ICON_MAP。
 * ```
 *
 * 为什么用 `?component` 查询参数
 * ============================
 * 仓库里还有别的 `.svg` 导入是**当 URL 用的**(`<img src={...}>`),
 * 全局声明 `*.svg` 会把那些也变成组件、类型直接对不上。
 * 查询参数把两种用法分开:带 `?component` 的才是图标组件。
 *
 * 自动登记
 * ========
 * 插件在 `buildStart` 时扫 `icons/svg/` 目录,生成 `icons/svg.generated.ts`
 * —— 里面是「语义名 → 组件」的映射表,`icons/index.ts` 把它合并进 `ICON_MAP`。
 * 于是新增定制图标只要丢文件,不用改任何代码。
 *
 * 为什么生成文件而不是 `import.meta.glob`,见 `customIconRegistry.ts` 的说明 ——
 * 一句话:glob 的 key 不是字面量,`AppIconName` 会塌成 `string`,拼写保护就没了。
 *
 * 启动开销
 * ========
 * **零。** 转换发生在构建期,产物就是一个普通 React 组件 ——
 * 运行时没有 SVG 解析、没有额外请求、没有全局注册表,
 * 与手写一个图标组件的产物完全一致。
 *
 * 消费方注意
 * ==========
 * 这个插件跑在**消费方的 Vite** 里,所以每个用到图标的构建都要装上:
 * 主应用 renderer、三个微应用、vitest。
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

import {
  customIconDirectory,
  findIconsDirectory,
  isCustomIconFile,
  writeCustomIconRegistry,
} from './customIconRegistry';
import { convertSvgToComponent } from './svgToReact';

export type SvgIconPluginOptions = {
  /**
   * 工厂模块(定义 `createCustomIcon` 的文件)名,默认 `customIcons`。
   *
   * 插件从 SVG 所在目录逐级向上找它 —— 所以 SVG 文件要放在
   * `customIcons.tsx` 所在目录的**子目录**里(默认是 `icons/svg/`)。
   */
  factoryFileName?: string;
  /**
   * `icons/` 目录的绝对路径 —— 定制图标注册表生成到 `icons/svg.generated.ts`。
   *
   * 默认从**配置文件所在目录**往上找 `packages/ui/src/components/icons`
   * (插件自己不知道自己在哪 —— 见 `findIconsDirectory` 的说明)。
   */
  iconsDirectory?: string;
};

/** 只有这个查询参数会走图标组件转换。 */
const COMPONENT_QUERY = 'component';

const FACTORY_EXTENSIONS = ['.tsx', '.ts'];

/** 向上找工厂文件的层数上限。 */
const FACTORY_SEARCH_DEPTH = 5;

export function aionuiSvgIconPlugin(options: SvgIconPluginOptions = {}): Plugin {
  const factoryFileName = options.factoryFileName ?? 'customIcons';
  let iconsDirectory: string | null = options.iconsDirectory ?? null;

  return {
    name: 'aionui:svg-icon',
    // 必须早于 vite:asset —— 否则 .svg 会被当成静态资源,变成一个 URL 字符串。
    enforce: 'pre',

    configResolved(config) {
      if (iconsDirectory) return;
      // 插件不知道自己的文件在哪(Vite 打包配置时把相对 import 内联了),
      // 只能从配置文件的目录往上反推仓库里的 `icons/`。
      const start = config.configFile ? path.dirname(config.configFile) : config.root;
      iconsDirectory = findIconsDirectory(start);
    },

    buildStart() {
      if (!iconsDirectory) return;
      const { changed, filePath } = writeCustomIconRegistry(iconsDirectory);
      if (changed) this.info(`定制图标注册表已更新:${filePath}`);
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

      const regenerate = (filePath: string) => {
        if (!isCustomIconFile(iconsDirectoryPath, filePath)) return;

        const { changed, filePath: registryPath } = writeCustomIconRegistry(iconsDirectoryPath);
        if (!changed) return;

        server.config.logger.info(`定制图标注册表已更新:${registryPath}`);
        // 映射表变了 —— 页面得重新加载才认得新的语义名。
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
      if (path.extname(filePath).toLowerCase() !== '.svg') return null;

      const source = fs.readFileSync(filePath, 'utf8');
      const name = toComponentName(path.basename(filePath, path.extname(filePath)));
      const factoryImport = resolveFactoryImport(filePath, factoryFileName);

      const { code, warnings } = convertSvgToComponent(source, { name, factoryImport });
      for (const warning of warnings) this.warn(warning);

      return { code, map: null };
    },
  };
}

/**
 * 文件名 → 组件名。
 *
 * 前缀 `_` 只是「**不自动登记进 `ICON_MAP`**」的标记(比如测试样例),
 * 不是组件名的一部分 —— 去掉它,class 才不会是 `i-icon-_sample-icon`。
 */
function toComponentName(fileName: string): string {
  return fileName.startsWith('_') ? fileName.slice(1) : fileName;
}

/**
 * 找到 `createCustomIcon` 所在文件,算出相对 import 说明符。
 *
 * 从 SVG 所在目录逐级向上找 —— SVG 放在 `icons/svg/` 下时,
 * 找到的是 `icons/customIcons.tsx`,相对说明符是 `../customIcons.tsx`。
 *
 * 相对的是 **SVG 文件所在目录**(生成代码的模块位置),不是找到工厂文件的那个目录。
 */
function resolveFactoryImport(filePath: string, factoryFileName: string): string {
  const svgDirectory = path.dirname(filePath);
  let directory = svgDirectory;

  for (let depth = 0; depth <= FACTORY_SEARCH_DEPTH; depth += 1) {
    for (const extension of FACTORY_EXTENSIONS) {
      const candidate = path.join(directory, `${factoryFileName}${extension}`);
      if (fs.existsSync(candidate)) {
        const relative = path.relative(svgDirectory, candidate).split(path.sep).join('/');
        return relative.startsWith('.') ? relative : `./${relative}`;
      }
    }

    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  throw new Error(
    `[aionui:svg-icon] 找不到 ${factoryFileName}.tsx —— 无法把 ${filePath} 转成图标组件。` +
      `SVG 文件要放在 ${factoryFileName}.tsx 所在目录的子目录里。`
  );
}
