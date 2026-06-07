import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ContentContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
}

const maxWidthClasses = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-full",
};

/**
 * Consistent content wrapper for all pages.
 * Tables and lists use `full`, forms use `sm` or `md`.
 */
export function ContentContainer({
  children,
  className,
  maxWidth = "full",
}: ContentContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 md:px-6 py-6",
        maxWidthClasses[maxWidth],
        className,
      )}
    >
      {children}
    </div>
  );
}
