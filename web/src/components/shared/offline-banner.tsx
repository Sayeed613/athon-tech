"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

/**
 * Offline banner. Renders a warning bar at the top of the page
 * when the browser reports no network connection.
 *
 * Place inside `AdminLayout` or the root layout.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-sm font-medium text-warning border-b border-warning/20">
      <WifiOff className="h-4 w-4" />
      <span>
        You are offline. Some features may not be available.
      </span>
    </div>
  );
}
