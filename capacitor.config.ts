import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.teachingboard.app',
  appName: 'TeachingBoard',
  webDir: 'dist-mobile',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  }
};

export default config;
