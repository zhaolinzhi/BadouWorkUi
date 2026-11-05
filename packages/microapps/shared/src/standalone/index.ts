/**
 * 独立运行(dev 直开子应用)时的公共件
 *
 * 三个微应用(notes / knowledge-base / meeting-recording)在 standalone 模式下
 * 缺的东西是同一批:shell 的样式、shell 的明暗主题。没有宿主,就得自己补上。
 * 这三件事与子应用业务无关,故放在共享包里,避免各抄一份。
 */
export { applyStandaloneTheme, resolveStandaloneTheme } from './theme';
export type { StandaloneTheme } from './theme';
export { loadStandaloneStyles } from './styles';
