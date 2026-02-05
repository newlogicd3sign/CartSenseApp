"use client";

import { useEffect } from "react";

export function SafeAreaWrapper({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const isNative = (window as any).Capacitor?.isNativePlatform?.() ?? false;
        if (isNative) {
            document.documentElement.classList.add("capacitor-app");
        }
    }, []);

    // Don't change DOM structure - let CSS handle safe areas
    return <>{children}</>;
}
