const { execSync } = require('child_process');

/**
 * 检出这个 app 是不是用 Developer ID 证书签的。
 *
 * `codesign -dv --verbose=4` 的输出里,Developer ID 签名的 app 会带
 * `Authority=Developer ID Application: ...`;只有 ad-hoc 签名(本机没有证书时的
 * 兜底)则只有 `flags=0x2(adhoc)`,没有任何 Authority 行。
 */
function isDeveloperIdSigned(appPath) {
  try {
    const info = execSync(`codesign -dv --verbose=4 "${appPath}" 2>&1`, { stdio: 'pipe' }).toString();
    return info.includes('Authority=Developer ID Application');
  } catch {
    return false;
  }
}

/**
 * 「这个包发给别人会不会被 Gatekeeper 拦」的提示文案。
 *
 * 只有 Developer ID 签名的包,通过微信 / 邮件 / 浏览器等渠道传给别人时才会被拦 ——
 * 对方看到「无法打开,因为它来自身份不明的开发者」。这个坑在构建机上完全看不出来,
 * 只有收到包的人才会撞上,所以要在构建时就把话说清楚。
 *
 * The warning a locally built, ad-hoc signed app will trigger on the recipient's
 * machine. Returns null when the app carries a Developer ID signature.
 */
function buildGatekeeperWarning(appName, signedWithDeveloperId) {
  if (signedWithDeveloperId) {
    return null;
  }
  return (
    `⚠️ ${appName} 只有 ad-hoc 签名(没有 Developer ID 证书)。` +
    `通过微信 / 邮件 / 浏览器等渠道发给别人时,对方的 macOS 会弹` +
    `「无法打开,因为它来自身份不明的开发者」。` +
    `处置:让对方右键「打开」,或执行 xattr -cr /Applications/${appName}.app 去掉隔离属性;` +
    `要在 CI 里出免弹窗的包,需配好 BUILD_CERTIFICATE_BASE64 / P12_PASSWORD / IDENTITY / ` +
    `APPLE_ID / APPLE_ID_PASSWORD / TEAM_ID 这几个 secret。`
  );
}

exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Lazy-load notarize because @electron/notarize is ESM-only
  const { notarize } = await import('@electron/notarize');

  const appName = context.packager.appInfo.productFilename;
  const appBundleId = context.packager.appInfo.id;
  const appPath = `${appOutDir}/${appName}.app`;

  // 先把签名类型说清楚:ad-hoc 签名的包发出去会被 Gatekeeper 拦。
  const gatekeeperWarning = buildGatekeeperWarning(appName, isDeveloperIdSigned(appPath));
  if (gatekeeperWarning) {
    console.warn(gatekeeperWarning);
  }

  // Check if app is actually signed before attempting notarization
  try {
    execSync(`codesign --verify --verbose "${appPath}"`, { stdio: 'pipe' });
    console.log(`App ${appName} is properly code signed`);
  } catch (error) {
    console.log(`App ${appName} is not code signed, applying ad-hoc signature...`);
    try {
      execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
      console.log(`Ad-hoc signature applied successfully to ${appName}`);
    } catch (adHocError) {
      console.error('Ad-hoc signing failed:', adHocError.message);
    }
    return;
  }

  // Skip notarization if credentials are not provided
  if (!process.env.appleId || !process.env.appleIdPassword) {
    console.log('Skipping notarization - missing Apple ID credentials');
    return;
  }

  console.log(`Starting notarization for ${appName} (${appBundleId})...`);

  try {
    await notarize({
      tool: 'notarytool',
      appBundleId,
      appPath: appPath,
      appleId: process.env.appleId,
      appleIdPassword: process.env.appleIdPassword,
      teamId: process.env.teamId,
    });
    console.log('Notarization completed successfully');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};

exports.buildGatekeeperWarning = buildGatekeeperWarning;
exports.isDeveloperIdSigned = isDeveloperIdSigned;
