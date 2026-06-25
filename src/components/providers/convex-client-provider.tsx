"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createContext, ReactNode, useContext, useMemo } from "react";

type ConvexClientProviderProps = {
  children: ReactNode;
};

const ConvexConfiguredContext = createContext(false);

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    if (!convexUrl) {
      return null;
    }

    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  if (!client) {
    return (
      <ConvexConfiguredContext.Provider value={false}>
        {children}
      </ConvexConfiguredContext.Provider>
    );
  }

  return (
    <ConvexConfiguredContext.Provider value>
      <ConvexProvider client={client}>{children}</ConvexProvider>
    </ConvexConfiguredContext.Provider>
  );
}

export function useConvexConfigured() {
  return useContext(ConvexConfiguredContext);
}
