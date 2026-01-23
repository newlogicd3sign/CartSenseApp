#!/bin/bash
# Switch to LOCAL DEVELOPMENT mode

echo "Switching to DEVELOPMENT mode..."

# Update capacitor.config.ts
cat > capacitor.config.ts << 'EOF'
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
EOF

# Update Info.plist - enable local networking
plutil -replace NSAppTransportSecurity -json '{"NSAllowsArbitraryLoads":true,"NSAllowsLocalNetworking":true}' ios/App/App/Info.plist

echo "✅ Switched to DEV mode"
echo "Run: npx cap sync ios && npx cap open ios"
