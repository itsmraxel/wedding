"use client";

import { ReactNode, useEffect, useMemo } from "react";
import { ConvexProvider, ConvexReactClient, useMutation } from "convex/react";
import { Toaster } from "@/components/ui/sonner";
import { api } from "../../convex/_generated/api";

function SeedOnFirstLoad() {
  const seed = useMutation(api.seed.init);
  useEffect(() => {
    // Idempotent — only writes when the database is empty.
    void seed({});
  }, [seed]);
  return null;
}

function ConvexShell({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const client = useMemo(() => {
    if (!url) return null;
    return new ConvexReactClient(url);
  }, [url]);

  if (!client) {
    return (
      <>
        {children}
        <Toaster position="bottom-right" />
      </>
    );
  }

  return (
    <ConvexProvider client={client}>
      <SeedOnFirstLoad />
      {children}
      <Toaster position="bottom-right" />
    </ConvexProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return <ConvexShell>{children}</ConvexShell>;
}
