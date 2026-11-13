import type { CapacitorConfig } from '@capacitor/cli';

// 👥 NKs Team — the team's CRM app (talking to parents only). Built by build-team.bat.
const config: CapacitorConfig = {
  appId:   'com.nkseduorbit.team',
  appName: 'NKs Team',
  webDir:  'dist-team',
  bundledWebRuntime: false,
  server: { androidScheme: 'https' },
  android: { adjustMarginsForEdgeToEdge: 'auto' }
};

export default config;
