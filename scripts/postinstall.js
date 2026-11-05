/**
 * Postinstall script for AionUi
 * Handles native module installation for different environments
 */

const { execSync } = require('child_process');
const { assertNodeVersion } = require('../packages/shared-scripts/src/assert-node-version.js');

// Note: web-tree-sitter is now a direct dependency in package.json
// No need for symlinks or copying - npm will install it directly to node_modules

function runPostInstall() {
  // node 版本闸门。放在最前面,因为版本过低时后面每一个步骤的报错都很难懂:
  // native 模块重建会挂在别处,husky 的 prepare 会报 "Unexpected token '||='",
  // 子应用的 vite 构建更是返回退出码 0 假装成功。这里先把它拦下来。
  //
  // Node version gate. It runs first because every later failure mode is cryptic on
  // an old node: the native rebuild dies somewhere unrelated, husky's prepare reports
  // "Unexpected token '||='", and the micro apps' vite build exits 0 while failing.
  try {
    assertNodeVersion();
  } catch (error) {
    console.error(`[postinstall] ${error.message}`);
    process.exit(1);
  }

  try {
    // Check if we're in a CI environment
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const electronVersion = require('../package.json').devDependencies.electron.replace(/^[~^]/, '');

    console.log(`Environment: CI=${isCI}, Electron=${electronVersion}`);

    if (isCI) {
      // In CI, skip rebuilding to use prebuilt binaries for better compatibility
      // 在 CI 中跳过重建，使用预编译的二进制文件以获得更好的兼容性
      console.log('CI environment detected, skipping rebuild to use prebuilt binaries');
      console.log('Native modules will be handled by electron-forge during packaging');
    } else {
      // In local environment, use electron-builder to install dependencies
      console.log('Local environment, installing app deps');
      execSync('bunx electron-builder install-app-deps', {
        stdio: 'inherit',
        env: {
          ...process.env,
          npm_config_build_from_source: 'true',
        },
      });
    }
  } catch (e) {
    console.error('Postinstall failed:', e.message);
    // Don't exit with error code to avoid breaking installation
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  runPostInstall();
}

module.exports = runPostInstall;
