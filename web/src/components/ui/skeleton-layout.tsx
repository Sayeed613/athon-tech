"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type SkeletonVariant = "list" | "detail" | "dashboard" | "form";

interface SkeletonLayoutProps {
  variant: SkeletonVariant;
  className?: string;
  rows?: number;
}

/**
 * SkeletonLayout — Predictive loading skeletons that match final layout structure.
 *
 * Each variant mirrors the exact layout of its corresponding page type:
 * - list:      Page header + filter bar + table rows + pagination
 * - detail:    Profile hero + metric cards + tabs + activity timeline
 * - dashboard: KPI row + 2-column widget grid
 * - form:      Card with fields + button bar
 */
export function SkeletonLayout({
  variant,
  className,
  rows = 8,
}: SkeletonLayoutProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* ── List Page Skeleton ───────────────────────────── */}
      {variant === "list" && (
        <>
          {/* Page header skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>

          {/* Filter bar skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-72" />
              <Skeleton className="h-9 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          {/* Table skeleton */}
          <div className="rounded-lg border">
            {/* Header row */}
            <div className="flex items-center gap-4 border-b px-4 py-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 flex-1" />
              ))}
            </div>
            {/* Data rows */}
            {Array.from({ length: Math.min(rows, 10) }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b px-4 py-4 last:border-0"
              >
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 flex-[2]" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>

          {/* Pagination skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </>
      )}

      {/* ── Detail Page Skeleton ─────────────────────────── */}
      {variant === "detail" && (
        <>
          {/* Back button */}
          <Skeleton className="h-5 w-32" />

          {/* Profile hero */}
          <div className="flex items-center gap-6 rounded-lg border p-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>

          {/* Tabs skeleton */}
          <div className="flex gap-2 border-b pb-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28 rounded-t-md" />
            ))}
          </div>

          {/* Tab content skeleton */}
          <div className="space-y-4 rounded-lg border p-6">
            <Skeleton className="h-4 w-48" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-2 w-2 mt-2 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Dashboard Page Skeleton ──────────────────────── */}
      {variant === "dashboard" && (
        <>
          {/* Page header */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>

          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-lg border p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>

          {/* Widget grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="grid gap-6 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="space-y-3 rounded-lg border p-4">
                    <Skeleton className="h-5 w-28" />
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-lg border p-4">
                <Skeleton className="h-5 w-36" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-3 rounded-lg border p-4">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Form Page Skeleton ───────────────────────────── */}
      {variant === "form" && (
        <>
          {/* Back button */}
          <Skeleton className="h-5 w-24" />

          {/* Page header */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>

          {/* Form card */}
          <div className="space-y-6 rounded-lg border p-6">
            <Skeleton className="h-5 w-36" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          </div>

          {/* Button bar */}
          <div className="flex items-center justify-end gap-3">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-28" />
          </div>
        </>
      )}
    </div>
  );
}
