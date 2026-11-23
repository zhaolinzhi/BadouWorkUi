/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 子应用内存路由器的**单例**创建器。
 *
 * 背景
 * ====
 * 子应用原来在 `App.tsx` 里这样拿 router:
 *
 * ```tsx
 * const router = useMemo(() => createRouter(routerBase), [routerBase]);
 * ```
 *
 * `useMemo` 的工厂函数在 **React 的 render 阶段**执行 —— 也就是说
 * `createMemoryRouter()` 是在渲染过程中被调用的。react-router 的
 * `createRouter` 内部会 `new DataRoutes(...)`,而 `DataRoutes` 用
 * **私有字段(WeakMap)**存自己的状态:
 *
 * ```js
 * var DataRoutes = class {
 *   constructor(routes) {
 *     __privateAdd(this, _routes);   // → _routes.has(this)
 *     ...
 *   }
 * };
 * _routes = new WeakMap();
 * ```
 *
 * 这个路径在**第二次打开子应用**时会抛:
 *
 * ```
 * TypeError: r.has is not a function
 *   at __privateAdd  (react-router)
 *   at new DataRoutes (react-router)
 *   at createRouter   (react-router)
 *   at createMemoryRouter (react-router-dom)
 * ```
 *
 * 根因是 `createRouter` 在 render 阶段跑第二次时,react-router 模块作用域里
 * 那个 `new WeakMap()` 拿到的不是预期的 WeakMap(见
 * `packages/microapps/notes/src/router/index.tsx` 的历史注释)。
 * 修法不是去猜 react-router 内部为什么坏,而是**根本不让 router 在 render
 * 阶段被创建**。
 *
 * 做法
 * ====
 * 把 router 的创建挪到 **按 base 缓存的单例**里:
 *
 * - 每个 `routerBase` 只会创建一次,子应用被 unmount 再 mount 时复用同一个
 *   router —— 这正是期望的语义(子应用内部的路由状态不该因为重新打开而重置);
 * - 身份稳定,`RouterProvider` 的
 *   `useLayoutEffect(() => router.subscribe(...), [router])` 不会因为身份变化
 *   而反复退订/重订;
 * - **第二次打开时 `createRouter` 根本不会被调用** —— 崩溃的那句
 *   `new DataRoutes()` 因此不会执行第二次;
 * - 创建只发生在**首次挂载**那一刻(`useState` 的惰性初值),之后每次重渲染
 *   都不会再碰它。
 *
 * 组件里用 `useRouter`(本文件末尾):它用 `useState` 的惰性初值,而不是
 * `useMemo`,因为 `useMemo` 的工厂在 render 阶段执行 —— 那正是崩溃现场。
 *
 * 注意 `createRouter` 工厂本身由子应用提供(notes / meeting-recording 的路由表
 * 不同),这里只负责"何时创建"和"是否复用"。
 *
 * 类型层面
 * ====
 * 下面的 `MemoryRouter` / `RouterFactory` / `getRouter` / `useRouter` 是泛型的。
 * 旧版本在 `MemoryRouter` 上写了 `[key: string]: unknown` 索引签名,而
 * react-router 的 `Router` 是不带索引签名的 interface,不可赋值过来,notes 与
 * meeting-recording 两个微应用各自报 TS2345 / TS2740。泛型化后,router 的具体
 * 类型由调用方传入的工厂函数推断,消费方无需强转即可对齐。这是纯类型改动,
 * 上面描述的运行时缓存语义完全不变。
 */
import React from 'react';

/**
 * router 对象的最小结构 —— 只声明本文件实际用到的成员,避免依赖 react-router 的类型。
 *
 * 刻意不带 `[key: string]: unknown` 索引签名:react-router 的 `Router` 是没有
 * 索引签名的 interface,不可赋值给带索引签名的类型。需要更具体的 router 类型
 * 时,经由 `RouterFactory` 的泛型参数传入(见该处说明)。
 */
export interface MemoryRouter {
  state: unknown;
  subscribe: (fn: (state: unknown) => void) => () => void;
  initialize?: () => MemoryRouter;
}

/**
 * 子应用提供的 router 工厂,也是泛型 `T` 的入口。
 *
 * `T` 从工厂返回值推断,沿 `getRouter` / `useRouter` 一路流到它们的返回类型;
 * `T extends MemoryRouter` 的约束保证缓存里的实例至少满足最小结构。这样 notes /
 * meeting-recording 等调用方不做强转就能拿回自己的具体 router 类型(react-router
 * 的 `Router` 在结构上满足 `MemoryRouter`)。
 */
export type RouterFactory<T extends MemoryRouter = MemoryRouter> = (routerBase: string) => T;

/**
 * 按 `routerBase` 缓存已创建的 router。
 *
 * 用 `Map` 而不是单个模块变量:不同 `routerBase` 理论上可以共存,
 * 而同一个 base 必须复用同一个实例(否则 `RouterProvider` 每次 render 都拿到
 * 新 router,`router.subscribe` 会被反复重订,子应用内的路由状态也会丢)。
 */
const routerCache = new Map<string, MemoryRouter>();

/**
 * 拿到(或首次创建)指定 `routerBase` 的 router。
 *
 * 调用时机由调用方决定 —— 推荐在**模块作用域**调用,或在组件的
 * `useState(() => getRouter(base))` 惰性初始化里调用(React 只在首次渲染时
 * 执行惰性初始值函数,不会在 render 阶段重复创建)。
 *
 * @param routerBase 路由基路径,作为缓存键。
 * @param factory    创建 router 的工厂(子应用提供)。
 */
export function getRouter<T extends MemoryRouter = MemoryRouter>(routerBase: string, factory: RouterFactory<T>): T {
  const cached = routerCache.get(routerBase);
  if (cached) {
    // 断言成立靠的是运行时约定而非类型系统:同一模块实例内,某个 base 只会经由
    // 上面这条路径被同一个 factory 首次填充(见文件头的缓存语义),缓存值必然就是
    // 该 factory 产出的 T。缓存键与 T 之间没有静态约束 —— 别把键当成可自由复用的。
    return cached as T;
  }

  const router = factory(routerBase);
  routerCache.set(routerBase, router);
  return router;
}

/**
 * 清空 router 缓存 —— 仅供测试使用。
 *
 * 单例缓存会跨测试存活,测试之间需要显式重置,否则一个测试里断言过的
 * router 身份会泄漏到下一个测试。
 */
export function __clearRouterCacheForTests(): void {
  routerCache.clear();
}

/**
 * 在 React 里拿到 router —— 组件级的薄封装。
 *
 * 与 `getRouter` 的区别只有一点:**base 变了要换 router**。
 *
 * 这里用 `useState` 的惰性初值 + 一个「base 变了就重新取」的 ref,而不是
 * `useMemo`:
 *
 * - `useMemo` 的工厂在 **render 阶段**执行 —— 那正是崩溃现场
 *   (`createMemoryRouter` → `new DataRoutes()` → `TypeError: r.has is not a
 *   function`)。`useMemo` 还可能因为 React 丢弃 memo 而重跑工厂,
 *   所以「只在 render 里创建」这件事靠 `useMemo` 根本保证不了。
 * - `useState` 的惰性初值只在**首次渲染**求值一次,之后永不重跑。
 *
 * base 变化时不能靠 render 阶段重建(同样会炸),所以这里把新 base 的
 * router 推迟到 **effect** 里创建:base 变了的那一帧先渲染旧 router,
 * effect 跑完再 setState 换上新的。三个子应用实际都用固定的 `'/'`,
 * 这条分支平时不会走到。
 */
export function useRouter<T extends MemoryRouter = MemoryRouter>(routerBase: string, factory: RouterFactory<T>): T {
  const [router, setRouter] = React.useState<T>(() => getRouter(routerBase, factory));
  const baseRef = React.useRef(routerBase);
  const factoryRef = React.useRef(factory);
  factoryRef.current = factory;

  React.useEffect(() => {
    if (baseRef.current === routerBase) return;
    baseRef.current = routerBase;
    // 创建发生在 effect 里 —— 不在 render 阶段。
    setRouter(getRouter(routerBase, factoryRef.current));
  }, [routerBase]);

  return router;
}
