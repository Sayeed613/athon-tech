"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateVariant =
  | "no-data"
  | "no-results"
  | "no-filters"
  | "error"
  | "offline";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
}

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  searchQuery?: string;
}

const variantStyles: Record<EmptyStateVariant, string> = {
  "no-data": "text-muted-foreground",
  "no-results": "text-muted-foreground",
  "no-filters": "text-muted-foreground",
  "error": "text-destructive",
  "offline": "text-warning",
};

/**
 * EmptyState — Five distinct empty state patterns for list pages.
 *
 * Variants:
 * - no-data:    First use, no records exist yet. Includes CTA to create.
 * - no-results: Search returned no matches. Includes clear search action.
 * - no-filters: Active filters returned no matches. Includes clear filters.
 * - error:      Failed to load data. Includes retry action.
 * - offline:    No network connection. Includes retry action.
 */
export function EmptyState({
  variant,
  title,
  description,
  icon: Icon,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      {/* Icon area */}
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full",
          variant === "error"
            ? "bg-destructive/10"
            : variant === "offline"
              ? "bg-warning/10"
              : "bg-muted",
        )}
      >
        {Icon ? (
          <Icon
            className={cn(
              "h-8 w-8",
              variantStyles[variant],
            )}
          />
        ) : (
          <svg
            className={cn("h-8 w-8", variantStyles[variant])}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            {variant === "no-data" && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            )}
            {variant === "no-results" && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            )}
            {variant === "no-filters" && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
              />
            )}
            {variant === "error" && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            )}
            {variant === "offline" && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.535 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a9 9 0 010-12.728m0 0L5.636 5.636m0 0l-2.829 2.829m2.829-2.829L3 3"
              />
            )}
          </svg>
        )}
      </div>

      {/* Title */}
      <h3 className="mt-6 text-base font-semibold text-foreground">
        {title}
      </h3>

      {/* Description */}
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="mt-6 flex items-center gap-3">
          {action && (
            <Button
              variant={action.variant ?? "default"}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant ?? "outline"}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
