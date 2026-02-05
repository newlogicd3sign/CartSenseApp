import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cartsenseapp.ios',
  appName: 'CartSense',
  webDir: 'out',
  server: {
    url: 'https://cartsenseapp.com',
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: '#ffffff',
    // Limits navigation to app-bound domains for better data persistence
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Ensure cookies and storage persist across app launches
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
