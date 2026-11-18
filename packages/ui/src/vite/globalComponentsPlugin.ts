/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 把 `@aionui/ui` 的图标 / 按钮注册成**全局可用**。
 *
 * 目标
 * ====
 * 业务代码直接写 `<AppIcon name="plus" />`、`<IconButton icon={...} label="删除" />`,
 * 不用在每个文件顶部背一行 import —— 图标与按钮是全产品重复度最高的两类标记。
 *
 * 为什么用构建期注入,而不是挂 `globalThis`
 * ==========================================
 * qiankun 的三个子应用共享同一个 `globalThis`,但**各自打包了自己的 React 与 Arco**
 * (见 `docs/qiankun/06-build-and-deploy.md`)。把组件挂到 `globalThis` 上,
 * 后加载的应用会覆盖先加载的那个 —— 先加载的应用于是拿别人的 React 元素去渲染,
 * 典型症状是 "Invalid hook call"。项目也已经不再走 `globalThis.React` 那套 UMD 约定。
 *
 * 构建期注入没有这个问题:每个应用注入的是**自己 bundle 里**的那份组件,
 * 和显式 import 完全等价。
 *
 * "不用 import" 是怎么做到的
 * ==========================
 * 1. **运行时**:本插件在 `transform` 阶段扫源码,发现用了 `<AppIcon />` 这类
 *    JSX 标签、而当前文件又没有绑定同名标识符时,补一行
 *    `import { AppIcon } from '@aionui/ui';`。
 * 2. **类型期**:`../globals.d.ts` 里的 `declare global` 让 TS 认这两个全局常量。
 *    两边指向同一个组件,类型与运行时一致。
 *
 * 已知取舍:被改写的文件拿不到精确的 sourcemap(与主应用既有的 `iconParkPlugin`
 * 同一取舍)。所以注入点选在「已有 import 之后」,尽量少挪动行号。
 */
import ts from 'typescript';
import type { Plugin } from 'vite';

/**
 * 免 import 即可使用的组件名。
 *
 * 目前只放图标与按钮 —— 这两类在产品里重复度最高,收益最大。
 * 其余共享组件(EmptyState / AsyncBoundary / ConfirmModal …)用得少,
 * 显式 import 更能说清依赖关系。
 */
export const GLOBAL_COMPONENT_NAMES = ['AppIcon', 'IconButton'] as const;

export type GlobalComponentName = (typeof GLOBAL_COMPONENT_NAMES)[number];

/** 共享组件的来源模块。 */
export const GLOBAL_COMPONENT_SOURCE = '@aionui/ui';

export type GlobalComponentsOptions = {
  /** 组件来源模块。默认 `@aionui/ui`。 */
  source?: string;
  /** 要注册的组件名。默认 `GLOBAL_COMPONENT_NAMES`。 */
  components?: readonly string[];
};

/**
 * 给「用了共享组件但没 import」的源码补上 import。
 *
 * 纯函数 —— 不碰文件系统,便于单测。
 */
export function injectGlobalComponentImports(code: string, options: GlobalComponentsOptions = {}): string {
  const source = options.source ?? GLOBAL_COMPONENT_SOURCE;
  const candidates = (options.components ?? GLOBAL_COMPONENT_NAMES).filter((name) => code.includes(name));
  // 快速过滤:文件里根本没提这些名字,连 AST 都不用解析
  if (candidates.length === 0) return code;

  const sourceFile = ts.createSourceFile('module.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const usedTags = collectJsxTagNames(sourceFile);
  const boundNames = collectModuleBindings(sourceFile);
  const missing = candidates.filter((name) => usedTags.has(name) && !boundNames.has(name));
  if (missing.length === 0) return code;

  const importStatement = `import { ${missing.join(', ')} } from '${source}';\n`;
  const insertAt = findImportInsertPosition(sourceFile, code);
  return code.slice(0, insertAt) + importStatement + code.slice(insertAt);
}

/**
 * 收集源码里出现过的 JSX 标签名。
 *
 * 走 AST 而不是正则:`Foo<Bar>` 这种泛型写法、字符串里的 `<AppIcon` 都会被正则误伤。
 */
function collectJsxTagNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = node.tagName;
      if (ts.isIdentifier(tagName)) names.add(tagName.text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return names;
}

/**
 * 收集模块顶层已经占用的标识符 —— import 的本地名、顶层声明的名字。
 *
 * 只要名字被占用了就不能再注入:重复声明会直接报 duplicate identifier,
 * 构建期就挂。
 */
function collectModuleBindings(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();

  const addBindingName = (name: ts.BindingName): void => {
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
      // 默认导入:`import AppIcon from '...'`
      if (clause.name) names.add(clause.name.text);
      if (clause.namedBindings) {
        // 命名空间导入:`import * as AppIcon from '...'`
        if (ts.isNamespaceImport(clause.namedBindings)) {
          names.add(clause.namedBindings.name.text);
        } else {
          // 具名导入:`import { AppIcon } from '...'` / `import { AppIcon as Foo } from '...'`
          // 取的是**本地名** —— 后者占用的是 `Foo`,`AppIcon` 仍然空着。
          // `import type` 也算占用:重复导入同一个本地名会撞 duplicate identifier。
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

/**
 * 注入位置:最后一条 import 之后。
 *
 * 没有 import 时插在第一条语句之前 —— `getStart()` 会跳过文件头注释,
 * 于是 license 头仍然留在最上面。
 */
function findImportInsertPosition(sourceFile: ts.SourceFile, code: string): number {
  let position = 0;
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) position = statement.end;
  }
  if (position > 0) {
    // 越过紧跟其后的换行 —— 否则新 import 会跟上一条挤在同一行
    const lineBreak = /^\r?\n/.exec(code.slice(position));
    if (lineBreak) position += lineBreak[0].length;
    return position;
  }

  const first = sourceFile.statements[0];
  return first ? first.getStart(sourceFile) : 0;
}

/**
 * Vite 插件:把共享组件注册成全局可用。
 *
 * 主应用(electron-vite)、三个微应用(vite)、根 vitest 配置都要装上它,
 * 否则「类型认得、运行时找不到」。
 */
export function aionuiGlobalComponentsPlugin(options: GlobalComponentsOptions = {}): Plugin {
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
