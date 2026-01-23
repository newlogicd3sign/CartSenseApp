#!/bin/bash
# Switch to PRODUCTION mode (for TestFlight/App Store)

echo "Switching to PRODUCTION mode..."

# Update capacitor.config.ts
cat > capacitor.config.ts << 'EOF'
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cartsenseapp.ios',
  appName: 'CartSense',
  webDir: 'out',
  server: {
    // Production URL
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
EOF

# Update Info.plist - disable arbitrary loads, only allow cartsenseapp.com
plutil -replace NSAppTransportSecurity -json '{"NSAllowsArbitraryLoads":false,"NSAllowsLocalNetworking":false,"NSExceptionDomains":{"cartsenseapp.com":{"NSIncludesSubdomains":true,"NSExceptionAllowsInsecureHTTPLoads":false}}}' ios/App/App/Info.plist

echo "✅ Switched to PRODUCTION mode"
echo "Run: npx cap sync ios && npx cap open ios"
