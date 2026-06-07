"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { AuthGuard } from "@/components/shared/auth-guard";
import { OfflineBanner } from "@/components/shared/offline-banner";

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Authenticated layout for all web roles.
 * Wraps content with AuthGuard for route protection + role checks.
 * Sidebar + TopNav + content area + offline detection.
 * Responsive: sidebar collapses on tablet/mobile.
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <OfflineBanner />
          <TopNav />
          <main className="flex-1 overflow-y-auto bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
