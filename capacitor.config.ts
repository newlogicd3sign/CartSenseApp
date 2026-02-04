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
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
