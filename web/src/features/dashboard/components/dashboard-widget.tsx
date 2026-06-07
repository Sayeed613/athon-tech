/** Athon — Dashboard Widget Wrapper Component */

import type { ReactNode } from "react";
import { RefreshCw, AlertCircle, Inbox } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardWidgetProps {
  title: string;
  children: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Standard widget wrapper for dashboard sections.
 * Handles loading skeleton, empty state, and error state uniformly.
 */
export function DashboardWidget({
  title,
  children,
  action,
  isLoading = false,
  isEmpty = false,
  emptyMessage = "No data available.",
  isError = false,
  errorMessage = "Failed to load data.",
  onRetry,
  className,
}: DashboardWidgetProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">
          {title}
        </CardTitle>
        {action && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">
              {errorMessage}
            </p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onRetry}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry
              </Button>
            )}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && isEmpty && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Inbox className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          </div>
        )}

        {/* Content */}
        {!isLoading && !isError && !isEmpty && children}
      </CardContent>
    </Card>
  );
}
