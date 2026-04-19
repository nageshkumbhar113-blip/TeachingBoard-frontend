import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.teachingboard.student',
  appName: 'TB Student',
  webDir:  'dist-student',
  bundledWebRuntime: false,
  server: { androidScheme: 'https' }
};

export default config;
