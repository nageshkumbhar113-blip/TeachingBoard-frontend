import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.teachingboard.admin',
  appName: 'TB Admin',
  webDir:  'dist-admin',
  bundledWebRuntime: false,
  server: { androidScheme: 'https' }
};

export default config;
