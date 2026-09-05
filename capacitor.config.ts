import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.nkseduorbit.student',
  appName: 'Nks EduOrbit',
  webDir:  'dist-student',
  bundledWebRuntime: false,
  server: { androidScheme: 'https' },
  // Real feature request: pinch-to-zoom on Notes content/images (dense
  // text, diagrams). Capacitor's WebView has this OFF by default
  // (android.zoomEnabled defaults to false — see
  // node_modules/@capacitor/android/.../CapConfig.java) — there's no way
  // to scope this to just one screen/route within a single WebView, so
  // it's enabled app-wide; it's a normal, expected capability elsewhere
  // too (e.g. zooming a diagram in an Exercise question).
  android: { zoomEnabled: true }
};

export default config;
