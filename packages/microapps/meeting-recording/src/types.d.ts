/**
 * Ambient type declarations for the microapp build.
 *
 * Mirrors the desktop app's `packages/desktop/src/renderer/types.d.ts`
 * subset that this microapp needs (only CSS Modules — images/SVGs are not
 * used here). Required because `tsc --noEmit` runs on this package
 * independently and Vite-only `vite/client` references are not sufficient.
 */
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
