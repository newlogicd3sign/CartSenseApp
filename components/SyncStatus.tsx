"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { getPendingSyncCount } from "@/lib/offlineStorage";
import { useNetwork } from "@/context/NetworkContext";

type SyncStatusProps = {
  className?: string;
  showWhenSynced?: boolean;
};

export function SyncStatus({ className = "", showWhenSynced = false }: SyncStatusProps) {
  const { isOnline } = useNetwork();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const updateCount = async () => {
      try {
        const count = await getPendingSyncCount();
        setPendingCount(count);
      } catch (err) {
        console.error("Error getting pending sync count:", err);
      }
    };

    void updateCount();

    // Poll for updates while offline
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Show syncing state when coming back online with pending items
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      setIsSyncing(true);
      // Auto-hide syncing after a few seconds (actual sync will update the count)
      const timer = setTimeout(() => setIsSyncing(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount]);

  // Don't show if no pending items and showWhenSynced is false
  if (pendingCount === 0 && !showWhenSynced && !isSyncing) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isSyncing ? (
        <>
          <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
          <span className="text-sm text-blue-600">Syncing...</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-amber-600">
            {pendingCount} pending {pendingCount === 1 ? "change" : "changes"}
          </span>
        </>
      ) : showWhenSynced ? (
        <>
          <Check className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-600">All synced</span>
        </>
      ) : null}
    </div>
  );
}
