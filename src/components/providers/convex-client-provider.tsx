"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createContext, ReactNode, useContext, useMemo } from "react";

type ConvexClientProviderProps = {
  children: ReactNode;
};

export const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
const META_AGENT_LAB_LOCAL_ONLY =
  process.env.NEXT_PUBLIC_META_AGENT_LAB_LOCAL_ONLY === "true";

const ConvexConfiguredContext = createContext(false);
const MetaAgentLabConfiguredContext = createContext(false);

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const client = useMemo(() => {
    return CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : undefined;
  }, []);

  if (!client) {
    return (
      <ConvexConfiguredContext.Provider value={false}>
        <MetaAgentLabConfiguredContext.Provider value={false}>
          {children}
        </MetaAgentLabConfiguredContext.Provider>
      </ConvexConfiguredContext.Provider>
    );
  }

  return (
    <ConvexConfiguredContext.Provider value>
      <MetaAgentLabConfiguredContext.Provider value={META_AGENT_LAB_LOCAL_ONLY}>
        <ConvexProvider client={client}>{children}</ConvexProvider>
      </MetaAgentLabConfiguredContext.Provider>
    </ConvexConfiguredContext.Provider>
  );
}

export function useConvexConfigured() {
  return useContext(ConvexConfiguredContext);
}

export function useMetaAgentLabConfigured() {
  return useContext(MetaAgentLabConfiguredContext);
}
