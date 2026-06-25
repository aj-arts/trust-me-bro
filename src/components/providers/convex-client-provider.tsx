"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createContext, ReactNode, useContext, useMemo } from "react";

type ConvexClientProviderProps = {
  children: ReactNode;
};

export const CONVEX_URL = "https://veracious-fish-815.convex.cloud";

const ConvexConfiguredContext = createContext(false);

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const client = useMemo(() => {
    return new ConvexReactClient(CONVEX_URL);
  }, []);

  return (
    <ConvexConfiguredContext.Provider value>
      <ConvexProvider client={client}>{children}</ConvexProvider>
    </ConvexConfiguredContext.Provider>
  );
}

export function useConvexConfigured() {
  return useContext(ConvexConfiguredContext);
}
