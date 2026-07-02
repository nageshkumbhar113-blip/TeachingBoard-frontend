import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.nkseduorbit.student',
  appName: 'Nks EduOrbit',
  webDir:  'dist-student',
  bundledWebRuntime: false,
  server: { androidScheme: 'https' }
};

export default config;
