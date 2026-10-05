import { ExpoConfig, ConfigContext } from 'expo/config';

import VERSION from './versions/version.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: 'AionUi Mobile',
    slug: 'aionui-mobile',
    version: VERSION.version,
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'aionui-mobile',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'ai.resopod.aionui',
      buildNumber: String(VERSION.buildNumber),
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: 'AionUi needs camera access to scan QR codes for server login.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/icon.png',
        backgroundColor: '#000000',
      },
      package: 'ai.resopod.aionui',
      versionCode: VERSION.buildNumber,
    },
    web: {
      output: 'static',
      favicon: './assets/images/icon.png',
    },
    // 临时注释 expo-dev-client 以便用 Expo Go 预览；恢复时取消下面那行注释
    plugins: ['expo-router', 'expo-secure-store', 'expo-camera'],
    // plugins: ['expo-router', 'expo-secure-store', 'expo-dev-client', 'expo-camera'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: '34b66303-fd5c-4d86-a790-0665d55f2017',
      },
    },
  };
};
