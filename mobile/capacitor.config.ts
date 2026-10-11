import type { CapacitorConfig } from '@capacitor/cli';

// Bundled static export only: there is intentionally no remote-origin setting here.
const config: CapacitorConfig = {
  appId: 'app.kitcha.mobile',
  appName: 'Kumaun',
  webDir: '../frontend/out',
  backgroundColor: '#f9fafb',
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    backgroundColor: '#f9fafb',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      launchFadeOutDuration: 200,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
      style: 'LIGHT',
    },
    StatusBar: {
      style: 'LIGHT',
      overlaysWebView: true,
    },
  },
};

export default config;
