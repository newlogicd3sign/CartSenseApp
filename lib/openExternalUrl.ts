import { AppLauncher } from "@capacitor/app-launcher";
import { Browser } from "@capacitor/browser";

const isCapacitor = () => {
    if (typeof window === "undefined") return false;
    return (window as any).Capacitor?.isNativePlatform?.() ?? false;
};

/**
 * Map of URL hostname patterns to their native app URL schemes.
 * Used to check if a native app is installed before trying Universal Links.
 * All Kroger family stores share the "kroger://" scheme (single Kroger app).
 */
const APP_SCHEMES: Record<string, string> = {
    "kroger.com": "kroger://",
    "smithsfoodanddrug.com": "kroger://",
    "ralphs.com": "kroger://",
    "fredmeyer.com": "kroger://",
    "kingsoopers.com": "kroger://",
    "frysfood.com": "kroger://",
    "dillons.com": "kroger://",
    "qfc.com": "kroger://",
    "harristeeter.com": "kroger://",
    "picknsave.com": "kroger://",
    "metromarket.net": "kroger://",
    "marianos.com": "kroger://",
    "food4less.com": "kroger://",
    "foodsco.net": "kroger://",
    "gerbes.com": "kroger://",
    "jaycfoods.com": "kroger://",
    "citymarket.com": "kroger://",
    "pay-less.com": "kroger://",
    "owensmarket.com": "kroger://",
    "bakersplus.com": "kroger://",
    "instacart.com": "instacart://",
};

/**
 * Get the native app URL scheme for a given URL, if known.
 */
function getAppScheme(url: string): string | null {
    try {
        const hostname = new URL(url).hostname.replace(/^www\./, "");
        return APP_SCHEMES[hostname] ?? null;
    } catch {
        return null;
    }
}

/**
 * Opens a URL, preferring the native app if installed.
 *
 * On iOS/Android:
 * 1. Checks if a known native app is installed (via URL scheme)
 * 2. If installed, opens via AppLauncher (triggers Universal Links → native app)
 * 3. If not installed, opens in the in-app browser (keeps user in the app)
 *
 * On web: Opens in a new tab.
 */
export async function openExternalUrl(url: string): Promise<void> {
    if (!isCapacitor()) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
    }

    const scheme = getAppScheme(url);

    if (scheme) {
        try {
            const { value: canOpen } = await AppLauncher.canOpenUrl({ url: scheme });
            if (canOpen) {
                await AppLauncher.openUrl({ url });
                return;
            }
        } catch {
            // canOpenUrl failed — fall through to in-app browser
        }
    }

    // No native app or unknown domain — open in in-app browser
    await Browser.open({ url });
}

/**
 * Opens a URL in the in-app browser.
 * Use this when you specifically want to keep the user in your app.
 */
export async function openInAppBrowser(url: string): Promise<void> {
    if (!isCapacitor()) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
    }
    await Browser.open({ url });
}
