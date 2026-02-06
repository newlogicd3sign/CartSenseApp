"use client";

import { useState, useEffect } from "react";
import { WifiOff, X } from "lucide-react";
import { useNetwork } from "@/context/NetworkContext";

type OfflineBannerProps = {
  dismissible?: boolean;
};

export function OfflineBanner({ dismissible = true }: OfflineBannerProps) {
  const { isOffline, isOnline } = useNetwork();
  const [dismissed, setDismissed] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Track when coming back online
  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
      setDismissed(false);
    } else if (wasOffline && isOnline) {
      setShowReconnected(true);
      setWasOffline(false);
      // Auto-hide reconnected message after 3 seconds
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, isOnline, wasOffline]);

  // Don't show anything if online and not showing reconnected message
  if (isOnline && !showReconnected) {
    return null;
  }

  // Don't show if dismissed and offline
  if (dismissed && isOffline) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${
        showReconnected ? "bg-green-50 border-b border-green-200" : "bg-amber-50 border-b border-amber-200"
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff
            className={`w-4 h-4 ${showReconnected ? "text-green-600" : "text-amber-600"}`}
          />
          <span
            className={`text-sm font-medium ${
              showReconnected ? "text-green-700" : "text-amber-700"
            }`}
          >
            {showReconnected
              ? "Back online! Syncing changes..."
              : "You're offline - Changes will sync when connected"}
          </span>
        </div>

        {dismissible && isOffline && (
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
