/** Athon — KPI Card Component */

import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  isLoading?: boolean;
  className?: string;
}

/**
 * Single KPI metric card with icon, value, and optional trend indicator.
 * Used in the dashboard's KPI row.
 */
export function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  isLoading = false,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <>
            <div className="text-3xl font-bold tracking-tight">
              {value}
            </div>
            {trend && (
              <div className="mt-1 flex items-center gap-1 text-xs">
                {trend.direction === "up" && (
                  <TrendingUp className="h-3 w-3 text-success" />
                )}
                {trend.direction === "down" && (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span
                  className={cn(
                    trend.direction === "up" && "text-success",
                    trend.direction === "down" && "text-destructive",
                    trend.direction === "neutral" &&
                      "text-muted-foreground"
                  )}
                >
                  {trend.value}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Bottom accent bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/20" />
    </Card>
  );
}

/**
 * Skeleton placeholder for KPI cards during initial load.
 */
export function KpiCardSkeleton() {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
      </CardContent>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted" />
    </Card>
  );
}
