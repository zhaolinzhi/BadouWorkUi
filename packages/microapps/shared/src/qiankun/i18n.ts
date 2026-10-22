/**
 * 让子应用接管 shell 的 i18next 实例。
 *
 * 背景见 `packages/desktop/src/renderer/micro-app/services/expose-i18n.ts`
 * 的顶部注释 —— 一句话版本:`react-i18next` 的 `getI18n()` 是模块级单例,
 * 子应用自己那份从未 `init()`,所以 `useTranslation()` 拿不到词条。
 *
 * 这里不 `init()`、只 `setI18n()`:词条资源和当前语言都由 shell 单点维护,
 * 子应用不重复持有,切语言自动跟随。
 */

/**
 * shell 挂到真 window 上的 i18next 实例的最小结构。
 *
 * 只声明用到的成员,避免 shared 包依赖 `i18next` 自身的类型(子应用可以
 * 装任意版本,`setI18n` 的入参只要有这个形状即可)。
 */
export interface AdoptableI18n {
  language?: string;
  t?: (...args: unknown[]) => unknown;
}

type I18nCarrier = { i18n?: AdoptableI18n };
/**
 * 形如 `react-i18next` 的 `setI18n`。参数类型故意收窄成 `any` ——
 * `setI18n` 声明的是 i18next 自己的 `i18n` 实例类型,而 shared 包不依赖
 * i18next(各子应用可以装不同版本),用 `unknown` / 自造结构都会与调用方的
 * 真实签名对不上。运行时这里只是把实例透传出去,不做任何类型相关的事。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type I18nSetter = (instance: any) => void;

/**
 * 读取真 window 上的 `window.i18n` 并 `setI18n()`。
 *
 * 必须用间接 eval 拿 window:子应用代码在 qiankun 沙箱里,裸 `window` 是
 * sandbox proxy,而 shell 挂的是**真** window 上的属性 —— 两者不是同一个对象。
 * 这与 `qiankun/ipc.ts` 里取 `window.ipcBridge` 是同一个坑、同一套解法。
 *
 * 拿不到时(standalone 运行、或 shell 尚未执行 expose-i18n)静默跳过:
 * 组件里 `t(key, { defaultValue })` 的兜底文案仍然有效。
 *
 * @returns 是否成功接管。
 */
export function adoptShellI18n(setI18n: I18nSetter): boolean {
  let instance: AdoptableI18n | undefined;
  try {
    const realWindow = (0, eval)('window') as I18nCarrier | undefined;
    instance = realWindow?.i18n;
  } catch {
    // CSP 禁用 unsafe-eval —— shell 的 expose 路径同样会被拦,
    // 子应用退回 defaultValue 兜底即可。
    return false;
  }
  if (!instance || typeof instance.t !== 'function') return false;
  setI18n(instance);
  return true;
}
