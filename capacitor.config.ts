import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cartsense.app',
  appName: 'CartSense',
  webDir: 'out',
  server: {
    // Load from your Vercel deployment
    // Production: 'https://cartsenseapp.com'
    url: 'http://192.168.1.150:3000',
    cleartext: true, // Allow HTTP for local dev
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
