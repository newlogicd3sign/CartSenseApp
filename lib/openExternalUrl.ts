import { AppLauncher } from "@capacitor/app-launcher";
import { Browser } from "@capacitor/browser";

/**
 * Check if running in Capacitor native app
 */
const isCapacitor = () => {
    if (typeof window === "undefined") return false;
    return (window as any).Capacitor?.isNativePlatform?.() ?? false;
};

/**
 * Opens a URL, preferring the native app if installed (via Universal Links).
 *
 * On iOS/Android:
 * 1. First tries AppLauncher.openUrl() which respects Universal Links
 *    - If the native app is installed and has Universal Links configured, it opens in the app
 *    - If not, it opens in the system browser (Safari/Chrome)
 * 2. Falls back to Browser.open() (in-app browser) if AppLauncher fails
 *
 * On web: Uses window.open()
 *
 * @param url The URL to open
 * @returns Promise that resolves when the URL is opened
 */
export async function openExternalUrl(url: string): Promise<void> {
    if (!isCapacitor()) {
        // Web: open in new tab
        window.open(url, "_blank", "noopener,noreferrer");
        return;
    }

    try {
        // Try to open via system handler - this respects Universal Links
        // If the app is installed and registered for this URL, it will open in the app
        // Otherwise, it opens in the system browser (Safari/Chrome) which is outside our app
        await AppLauncher.openUrl({ url });
    } catch (error) {
        // AppLauncher failed (might not support this URL type)
        // Fall back to in-app browser
        console.log("[openExternalUrl] AppLauncher failed, falling back to Browser:", error);
        await Browser.open({ url });
    }
}

/**
 * Opens a URL in the in-app browser.
 * Use this when you specifically want to keep the user in your app.
 *
 * @param url The URL to open
 */
export async function openInAppBrowser(url: string): Promise<void> {
    if (!isCapacitor()) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
    }
    await Browser.open({ url });
}
