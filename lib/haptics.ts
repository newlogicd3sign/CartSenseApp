import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// Check if running in Capacitor
const isCapacitor = () => {
    if (typeof window === "undefined") return false;
    return (window as any).Capacitor?.isNativePlatform?.() ?? false;
};

/**
 * Light impact - for subtle UI feedback (button taps, selections)
 */
export const hapticLight = async () => {
    if (!isCapacitor()) return;
    try {
        await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
        // Haptics not available
    }
};

/**
 * Medium impact - for standard interactions (toggles, confirmations)
 */
export const hapticMedium = async () => {
    if (!isCapacitor()) return;
    try {
        await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
        // Haptics not available
    }
};

/**
 * Heavy impact - for significant actions (delete, submit)
 */
export const hapticHeavy = async () => {
    if (!isCapacitor()) return;
    try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (e) {
        // Haptics not available
    }
};

/**
 * Success notification - for successful operations
 */
export const hapticSuccess = async () => {
    if (!isCapacitor()) return;
    try {
        await Haptics.notification({ type: NotificationType.Success });
    } catch (e) {
        // Haptics not available
    }
};

/**
 * Warning notification - for warnings
 */
export const hapticWarning = async () => {
    if (!isCapacitor()) return;
    try {
        await Haptics.notification({ type: NotificationType.Warning });
    } catch (e) {
        // Haptics not available
    }
};

/**
 * Error notification - for errors
 */
export const hapticError = async () => {
    if (!isCapacitor()) return;
    try {
        await Haptics.notification({ type: NotificationType.Error });
    } catch (e) {
        // Haptics not available
    }
};

/**
 * Selection changed - very light tap for selection changes
 */
export const hapticSelection = async () => {
    if (!isCapacitor()) return;
    try {
        await Haptics.selectionChanged();
    } catch (e) {
        // Haptics not available
    }
};
