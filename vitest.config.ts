import { defineConfig } from 'vitest/config';
import path from 'path';

import { aionuiGlobalComponentsPlugin, aionuiSvgIconPlugin } from './packages/ui/src/vite/index.ts';

const aliases = {
  '@/': path.resolve(__dirname, './packages/desktop/src') + '/',
  '@process/': path.resolve(__dirname, './packages/desktop/src/process') + '/',
  '@renderer/': path.resolve(__dirname, './packages/desktop/src/renderer') + '/',
  '@worker/': path.resolve(__dirname, './packages/desktop/src/process/worker') + '/',
  '@mcp/models/': path.resolve(__dirname, './packages/desktop/src/common/models') + '/',
  '@mcp/types/': path.resolve(__dirname, './packages/desktop/src/common') + '/',
  '@mcp/': path.resolve(__dirname, './packages/desktop/src/common') + '/',
  // Used by `packages/microapps/notes` to share adapter/mapper with main app.
  '@common/': path.resolve(__dirname, './packages/desktop/src/common') + '/',
  // Shared qiankun helpers consumed by all three micro-apps.
  // The microapp-level Vite alias still wins at build time (so each sub-app's bundle
  // resolves it), but vitest transforms with the root config — this root-level alias
  // keeps tests in sync.
  '@aionui/microapp-shared': path.resolve(__dirname, './packages/microapps/shared/src/index.ts'),
  // 主应用与三个微应用共用的 UI 组件层。
  // 与 microapp-shared 同样走源码级 alias —— 包内不发布构建产物,
  // 消费方的 bundler 各自把用到的部分打进自己的 chunk。
  '@aionui/ui': path.resolve(__dirname, './packages/ui/src/index.ts'),
  // UnoCSS 的虚拟模块入口。应用入口 `import 'uno.css'`,没有 UnoCSS 插件时
  // 解析不到会直接让测试文件加载失败 —— 指到一个空样式文件即可(测试不依赖样式)。
  'uno.css': path.resolve(__dirname, './tests/stubs/uno.css'),
};

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  plugins: [
    // 全局注册 @aionui/ui 的图标 / 按钮 —— 测试里也能直接写 <AppIcon />,
    // 不用每个文件都 import。少了它,类型过了运行时却报 ReferenceError。
    aionuiGlobalComponentsPlugin(),
    // `*.svg?component` 编译成图标组件 —— 少了它,测试里导入定制图标会拿到一个 URL 字符串。
    aionuiSvgIconPlugin(),
  ],
  test: {
    globals: true,
    // CI runners (especially windows-2022) can be slow enough that dom tests
    // rendering heavy components occasionally exceed the local 10s budget.
    testTimeout: process.env.CI ? 30000 : 10000,
    // Use projects to run different environments (Vitest 4+)
    projects: [
      // Node environment tests (existing tests)
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'packages/web-host/src/**/*.test.ts',
            'packages/desktop/src/renderer/micro-app/**/*.test.ts',
            'packages/desktop/src/renderer/shared/**/*.test.ts',
            'packages/desktop/src/process/resources/**/*.test.ts',
            'packages/desktop/src/process/backend/**/*.test.ts',
            'packages/microapps/**/*.test.ts',
            'packages/ui/src/**/*.test.ts',
            'tests/unit/**/*.test.ts',
            'tests/unit/**/test_*.ts',
            'tests/integration/**/*.test.ts',
            'tests/regression/**/*.test.ts',
          ],
          exclude: [
            'tests/unit/**/*.dom.test.ts',
            'tests/unit/**/*.dom.test.tsx',
            'packages/microapps/**/*.dom.test.ts',
            'packages/microapps/**/*.dom.test.tsx',
          ],
          setupFiles: ['./tests/vitest.setup.ts'],
        },
      },
      // jsdom environment tests (React component/hook tests)
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: [
            'tests/unit/**/*.dom.test.ts',
            'tests/unit/**/*.dom.test.tsx',
            'tests/integration/**/*.dom.test.ts',
            'tests/integration/**/*.dom.test.tsx',
            'packages/desktop/src/renderer/micro-app/**/*.dom.test.tsx',
            'packages/desktop/src/renderer/micro-app/**/*.test.tsx',
            'packages/desktop/src/renderer/shared/**/*.dom.test.tsx',
            'packages/desktop/src/renderer/shared/**/*.test.tsx',
            'packages/microapps/**/*.dom.test.ts',
            'packages/microapps/**/*.dom.test.tsx',
            'packages/microapps/**/*.test.tsx',
            'packages/ui/src/**/*.dom.test.ts',
            'packages/ui/src/**/*.dom.test.tsx',
            'packages/ui/src/**/*.test.tsx',
          ],
          setupFiles: ['./tests/vitest.dom.setup.ts'],
        },
      },
    ],
    benchmark: {
      include: ['tests/bench/**/*.bench.ts'],
      outputFile: './bench-results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Cover ALL source code by default — new files are automatically included.
      // Only exclude files that genuinely cannot be unit-tested (entry points,
      // type-only files, static assets, etc.).
      include: ['packages/desktop/src/**/*.{ts,tsx}', 'packages/**/src/**/*.{ts,tsx}'],
      exclude: [
        // Type declaration files (no runtime code)
        'packages/**/src/**/*.d.ts',

        // Electron entry points (require Electron runtime)
        'packages/desktop/src/index.ts',
        'packages/desktop/src/preload.ts',

        // Shims / polyfills
        'packages/desktop/src/common/utils/shims/**',

        // Pure type / constant files
        'packages/desktop/src/common/types/**',

        // Static assets and i18n JSON (no logic)
        'packages/desktop/src/renderer/**/*.json',
        'packages/desktop/src/renderer/**/*.svg',
        'packages/desktop/src/renderer/**/*.css',

        // i18n config (JSON-only)
        'packages/desktop/src/common/config/i18n-config.json',
      ],
      // Thresholds apply to the included file set.
      // Keeping them informational until coverage ramps up across all files.
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
