"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { useNetworkStatus, type NetworkStatus } from "@/lib/hooks/useNetworkStatus";

const NetworkContext = createContext<NetworkStatus | null>(null);

type NetworkProviderProps = {
  children: ReactNode;
};

export function NetworkProvider({ children }: NetworkProviderProps) {
  const networkStatus = useNetworkStatus();

  return (
    <NetworkContext.Provider value={networkStatus}>
      {children}
    </NetworkContext.Provider>
  );
}

/**
 * Hook to access network status from context.
 * Must be used within a NetworkProvider.
 */
export function useNetwork(): NetworkStatus {
  const context = useContext(NetworkContext);

  if (context === null) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }

  return context;
}
