"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "@/components/ui/sonner";

interface AppProviderProps {
  children: ReactNode;
}

/**
 * Root provider composition:
 * QueryProvider → ThemeProvider → children → Toaster
 */
export function AppProvider({ children }: AppProviderProps) {
  return (
    <QueryProvider>
      <ThemeProvider>
        {children}
        <Toaster richColors closeButton duration={5000} />
      </ThemeProvider>
    </QueryProvider>
  );
}
