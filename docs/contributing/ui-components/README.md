# 公共组件使用手册（`@aionui/ui`）

主应用（Electron renderer）与三个 qiankun 微应用（notes / knowledge-base / meeting-recording）共用的界面组件层。

- 包位置：[packages/ui/](../../../packages/ui)
- 包名：`@aionui/ui`
- 源码级共享：**包内不发布构建产物**，消费方的 bundler 各自把用到的部分打进自己的 chunk（与 `@aionui/microapp-shared` 同一模式）

---

## 组件文档

一件一页，直接查 Props：

| 组件                               | 解决什么问题                                          | 状态                |
| ---------------------------------- | ----------------------------------------------------- | ------------------- |
| [AppIcon](app-icon.md)             | 主应用与微应用的图标尺寸、描边宽度、颜色不一致        | 可用                |
| [EmptyState](empty-state.md)       | 三个微应用各写一份的空状态，结构与间距各不相同        | 可用                |
| [AsyncBoundary](async-boundary.md) | 四个微应用各写一遍的 loading / error / empty 三态渲染 | 可用                |
| [ConfirmModal](confirm-modal.md)   | notes / KB 各写一份的删除确认弹窗包装                 | 可用 · 两处已接入   |
| [IconButton](icon-button.md)       | 图标按钮的尺寸、圆角、禁用态各写各的                  | 可用                |
| [MoreMenu](more-menu.md)           | notes 两处 + KB 一处各写一份的「⋮」下拉菜单           | 可用 · 三处已接入   |
| [AppHeader](app-header.md)         | notes 工具条与各页顶部条结构各不相同                  | 可用 · notes 已接入 |
| [cx](cx.md)                        | 拼接 className                                        | 可用                |

已经接入的地方（可以直接照抄用法）：

| 位置                                        | 用的组件       |
| ------------------------------------------- | -------------- |
| notes 的「清空笔记」「删除笔记/笔记本」弹窗 | `ConfirmModal` |
| knowledge-base 的「删除知识库」弹窗         | `ConfirmModal` |
| notes 的顶部工具条                          | `AppHeader`    |
| notes 笔记行 / 笔记本行、知识库行的「⋮」    | `MoreMenu`     |

---

## 定位：两个公共包的分工

仓库里有两个公共包，别选错：

| 包                        | 管什么                                                                        | 依赖方向                                          |
| ------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| `@aionui/microapp-shared` | **微应用运行时**：qiankun 生命周期、standalone 样式/主题、IPC 解析、i18n 接管 | 依赖 `@renderer/micro-app/types`（主应用侧）      |
| `@aionui/ui`              | **界面**：跨应用复用的 React 组件与工具                                       | 只依赖 React / Arco / icon-park，**不依赖主应用** |

判据很简单：

- 需求是「这个应用怎么跑起来」→ `@aionui/microapp-shared`
- 需求是「这个界面长什么样」→ `@aionui/ui`

`@aionui/ui` 不 import `@renderer` / `@common` / `@aionui/microapp-shared`。这条不是洁癖 —— 一旦反向依赖，共享层就会被主应用的实现细节绑死，微应用没法独立构建。

---

## 快速上手

### 1. 声明依赖

四个消费方（主应用 + 三个微应用）的 `package.json` 都要加：

```json
{
  "dependencies": {
    "@aionui/ui": "workspace:*"
  }
}
```

然后在仓库根跑一次 `bun install` 建立 workspace 软链。

> `node_modules/@aionui/ui` 是指向 `packages/ui` 的软链。**软链存在不代表构建能用** —— 各工程还需要各自的 alias，见下一节。

### 2. 配置 alias

包内导出的是 `.ts` 源码（`main`/`types` 都指向 `./src/index.ts`），所以每个消费方都得让 bundler 和 TS 知道它指向哪儿。

| 工程               | 需要改的地方                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 三个微应用         | `vite.config.ts` 的 `resolve.alias` + `tsconfig.json` 的 `compilerOptions.paths` + `package.json` 的 `dependencies`    |
| 主应用（Electron） | `electron.vite.config.ts` 的 renderer `resolve.alias` + 根 `tsconfig.json` 的 `compilerOptions.paths` + `package.json` |
| 根 vitest          | `vitest.config.ts` 的 `resolve.alias`                                                                                  |

各工程的写法（**注意相对层数不同**）：

```ts
// packages/microapps/<name>/vite.config.ts —— 微应用与 microapp-shared 同为 packages/microapps/ 下
'@aionui/ui': path.resolve(__dirname, '../../ui/src/index.ts'),

// packages/desktop/electron.vite.config.ts —— 这里是相对 CWD(仓库根)的
'@aionui/ui': resolve('packages/ui/src/index.ts'),
```

```jsonc
// packages/microapps/<name>/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@aionui/ui": ["../../ui/src/index.ts"],
    },
  },
}
```

```ts
// 根 vitest.config.ts
'@aionui/ui': path.resolve(__dirname, './packages/ui/src/index.ts'),
```

> ⚠️ **改了 alias 必须单独跑一次该微应用的 `vite build`**。测试和 `tsc` 都走根 `vitest.config.ts` / `node_modules` 软链那套解析，跟微应用自己的 `vite.config.ts` 无关 —— alias 写错了测试全绿、构建才炸。见[常见坑](#常见坑)。

### 3. 使用

```tsx
import { AppIcon, AsyncBoundary, EmptyState } from '@aionui/ui';
```

只能从**根入口** `@aionui/ui` 导入 —— 根 barrel 已经把全部组件和类型 re-export 出来了。

> 为什么不提供 `@aionui/ui/components` 子路径：各消费方的 `resolve.alias` 是**前缀匹配**，
> `@aionui/ui/components` 会被拼成 `.../src/index.ts/components` 而解析失败。
> 想要子路径就得把 5 处 alias 全改成正则，收益不抵成本。

---

## 样式与主题

### 为什么用 CSS 变量而不是 Context

qiankun 的沙箱**不共享 React 实例**，所以 React Context 跨不了应用边界。但主应用和微应用渲染在**同一个 `document`** 里 —— CSS 自定义属性天然继承。

结论：**跨应用的状态一律走 props 或 CSS 变量，不走 Context。**

### 语义 token

共享层只用语义 token，不硬编码色值。token 定义在 [packages/desktop/src/renderer/styles/uno-tokens.ts](../../../packages/desktop/src/renderer/styles/uno-tokens.ts)，由 shell 与三个微应用共用（`sharedTheme` / `sharedRules` / `sharedPresets`）。

| 类别        | 用法                                                                    | 变量                      |
| ----------- | ----------------------------------------------------------------------- | ------------------------- |
| 文字颜色    | `text-t-primary` `text-t-secondary` `text-t-tertiary` `text-t-disabled` | `--text-primary` 等       |
| 背景色      | `bg-base` `bg-1` … `bg-10` `bg-hover` `bg-active`                       | `--bg-base` `--bg-1` 等   |
| 边框色      | `border-b-base` `border-b-light` `border-b-1` … `border-b-3`            | `--border-base` 等        |
| 语义状态色  | `text-primary` `bg-success` `text-danger` …                             | `--primary` `--success` … |
| 品牌色      | `bg-brand` `text-brand-light` `bg-brand-hover`                          | `--brand` 等              |
| Arco 原生色 | `text-1` … `text-4` `bg-fill-1` … `bg-fill-4` `border-arco-1` …         | `--color-text-*` 等       |
| AOU 色系    | `bg-aou-1` … `bg-aou-10`                                                | `--aou-1` …               |

在共享层组件里写样式：

```tsx
<div className='text-13px text-t-secondary' />
```

### 微应用的坑：UnoCSS 虚拟模块撞车

微应用点开之后 shell 样式塌掉，根因是 Vite 客户端会互相认领 `<style>` 标签。每个应用必须有专属的 `virtualModulePrefix`（`__uno_shell` / `__uno_notes` / `__uno_kb` / `__uno_mr`），否则隔离不了。前缀只影响 dev 的样式注入，产物 CSS 不受影响。

### standalone（独立运行）下的样式

微应用单独 `dev` 直开时没有 shell 的样式与明暗主题，靠 `@aionui/microapp-shared` 的 `loadStandaloneStyles` / `applyStandaloneTheme` 补齐 —— 这也是共享层**不注入全局 CSS、不带 preflight** 的原因：微应用的样式会被搬进真实 document，`*` 选择器会污染 shell 页面。

---

## i18n 约定

**共享层组件自带零面向用户的文案。** 所有文字由调用方用 `t(key, { defaultValue })` 算好再传进来。

原因有二：

1. 共享包不在 shell 的 i18n 词条体系里，硬编码英文违反项目的 i18n 规则（AGENTS.md 的硬性阻塞项）。
2. 独立运行（dev 直开微应用）时没有 shell 的 i18next 实例，只有调用方自己的兜底才靠谱。

```tsx
// ✅
<EmptyState title={t('settings.notesNoSelection', { defaultValue: 'Select a note to start editing' })} />

// ❌ 共享层组件内部硬编码
<EmptyState title="暂无笔记" />
```

新增文案时：

- 词条加到主应用的 `packages/desktop/src/renderer/services/i18n/locales/<lang>/<module>.json`（**13 种语言都要加**），`defaultValue` 用英文。
- 跑 `bun run i18n:types` 重新生成类型定义，再跑 `node scripts/check-i18n.js` 校验。

---

## 新增组件的硬性约束

在 `packages/ui` 里加组件前，先过这五条：

1. **不 import `@renderer` / `@common` / `@aionui/microapp-shared`** —— 那些是主应用侧路径，反向依赖会把共享层绑死。
2. **不注入全局 CSS、不带 preflight** —— 只用 CSS Module 或 UnoCSS 工具类。
3. **颜色只用语义 token**，不硬编码色值。
4. **组件自带零面向用户的文案** —— 文案由调用方传入。
5. **不用 React Context 传跨应用状态** —— 跨应用状态走 props 或 CSS 变量。

另外两条工程约定：

- **必须写测试**。组件测试放 `packages/ui/src/components/__tests__/`，文件名 `*.dom.test.tsx`（DOM 环境）。命名约定与断言示例见同目录已有文件。
- **只用 `@arco-design/web-react` 的组件**，不要写裸的 `<button>` / `<input>` / `<select>`（AGENTS.md 硬性要求）。图标用 `@icon-park/react`。

新增后记得：

1. 在本目录建一页（`docs/contributing/ui-components/<组件名>.md`）。
2. 把链接加到上面的[组件文档](#组件文档)表格里。

---

## 还没进共享层的组件

主应用内部有一批 `Aion*` 组件，目前**只能在主应用内用**，微应用拿不到：

`packages/desktop/src/renderer/components/base/`

```
AionModal          AionScrollArea     AionCollapse       AionSelect
AionSteps          AionSearchInput    AionInlineSearchInput
ModalWrapper       StepsWrapper       FileChangesPanel
FeedbackButton     ButlerDiagnoseButton  TalkToButlerButton
```

它们还没进共享层的原因是**耦合**：`AionModal` 的 `fontScale` 来自 shell 的 `ThemeContext`（跨不了沙箱），`ModalWrapper` / `StepsWrapper` 也引用了主应用侧的类型。迁移前需要先把这些改成 props。

规划中的下一步（尚未实现）：把 `AionModal` 解耦后迁入。

**微应用需要类似能力时怎么办**：先在 `packages/ui` 里加一个不依赖主应用的组件；确实需要 `AionModal` 这类复杂能力时，走上面的解耦流程，别在微应用里复制一份。

---

## 常见坑

### alias 写错，测试却全绿

**症状**：改完微应用的 `vite.config.ts` alias，测试和 `tsc` 都过，`vite build` 却报 `Could not load .../src/index.ts`。

**原因**：根 `vitest.config.ts` 另有一套正确的 alias，测试用根配置解析；`tsconfig.json` 的 `paths` 写错时会被 `node_modules/<pkg>` 的真实软链兜住。只有走微应用自己 `vite.config.ts` 的 `vite build` 才会暴露。

**修法**：改完微应用 alias 立刻跑一次 `cd packages/microapps/<name> && npx vite build`。

### 相对层数搞混

`@aionui/microapp-shared` 与微应用同为 `packages/microapps/` 下（`../shared/src`）；`@aionui/ui` 在 `packages/` 下（`../../ui/src`）。两个层级不同，别照抄。

### 想按子路径 import

`import { AppIcon } from '@aionui/ui/components'` **解析不了**。各消费方的 `resolve.alias` 是前缀匹配，`@aionui/ui/components` 会被拼成 `.../src/index.ts/components`。统一从根入口 `@aionui/ui` 导入 —— 根 barrel 已经 re-export 了全部组件和类型。

### 包内不发布构建产物

`@aionui/ui` 的 `main` 指向 `./src/index.ts` —— 它**不是一个能 `npm publish` 的库**，只是 monorepo 内的源码级共享。消费方的 bundler 负责把它编进自己的 chunk。这也意味着：共享层里的代码必须 tree-shakable、无副作用、不注入全局 CSS。

### 边框色的类名有坑

`border-b-base` **不是** `var(--border-base)` —— UnoCSS 会把它拆成「底边 + 颜色 `base`」，而主题里的 `base` 是**背景色** `var(--bg-base)`。边框色的主题键叫 `b-base`，所以类名得写成 `border-b-b-base`：

```css
.border-b-base {
  border-bottom-color: var(--bg-base);
} /* ← 背景色，不是边框色 */
.border-b-b-base {
  border-bottom-color: var(--border-base);
} /* ← 这才是边框色 */
```

`border-b-light` 同理 —— 拿到的是 presetWind3 的 `light` 色，不是 `--border-light`。

另外有两个**根本不生成任何 CSS** 的死名字（仓库里到处在用，shell 和微应用都有）：

- `bg-bg-0`
- `border-border-2`

写完新样式记得去构建产物里确认类名真的生成了：

```bash
grep -o "\.border-b-b-base{[^}]*}" packages/microapps/notes/dist/assets/index-*.css
```

### UnoCSS 会扫到 packages/ui 吗

会。微应用的 UnoCSS 通过 alias 把 `@aionui/ui` 解析到 `packages/ui/src/**` 的真实路径（不在 `node_modules` 下），所以共享层里的工具类会被一起生成。前提是**类名必须是字面量** —— 拼出来的类名（如 `` `!h-${size}px` ``）扫不到。
