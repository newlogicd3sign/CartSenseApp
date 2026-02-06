"use client";

import { useState, useEffect, useCallback } from "react";

export type NetworkStatus = {
  isOnline: boolean;
  isOffline: boolean;
};

/**
 * Hook for detecting network connectivity status.
 * Uses navigator.onLine and online/offline events.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(() => {
    // Default to online for SSR
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  const handleOnline = useCallback(() => {
    setIsOnline(true);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    // Set initial state on client
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}
