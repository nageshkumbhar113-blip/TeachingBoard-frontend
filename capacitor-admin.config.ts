import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.teachingboard.admin',
  appName: 'TB Admin',
  webDir:  'dist-admin',
  bundledWebRuntime: false,
  server: { androidScheme: 'https' },
  // Same targetSdk 36 edge-to-edge concern as capacitor-student.config.ts —
  // see its comment for why.
  android: { adjustMarginsForEdgeToEdge: 'auto' }
};

export default config;
