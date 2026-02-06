"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { useNetwork } from "@/context/NetworkContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OfflinePage() {
  const { isOnline } = useNetwork();
  const router = useRouter();

  // Redirect back when connection is restored
  useEffect(() => {
    if (isOnline) {
      router.back();
    }
  }, [isOnline, router]);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#f8fafb] flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-gray-400" />
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          You're offline
        </h1>

        <p className="text-gray-500 mb-8">
          It looks like you've lost your internet connection. Some features may be unavailable until you're back online.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#4A90E2] text-white font-medium rounded-xl hover:bg-[#357ABD] transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>

          <p className="text-sm text-gray-400">
            You can still view your saved meals and shopping list while offline.
          </p>
        </div>
      </div>
    </div>
  );
}
