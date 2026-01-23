import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cartsenseapp.ios',
  appName: 'CartSense',
  webDir: 'out',
  server: {
    // Local development
    url: 'http://192.168.1.150:3000',
    cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: '#ffffff',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
