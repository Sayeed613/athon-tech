/** Athon — Quick Action Card Component */

import { type LucideIcon, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface QuickActionCardProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  href: string;
  variant?: "default" | "primary";
  shortcut?: string;
}

/**
 * Clickable quick-action card for the dashboard.
 * Links to a specific creation page with icon, label, and optional keyboard shortcut.
 */
export function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  variant = "default",
  shortcut,
}: QuickActionCardProps) {
  return (
    <Link href={href} className="group block">
      <Card
        className={cn(
          "cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
          variant === "primary" &&
            "border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10"
        )}
      >
        <CardContent className="flex items-center gap-4 p-4">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
              variant === "primary"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground group-hover:bg-accent"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{title}</p>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {shortcut && (
              <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                {shortcut}
              </kbd>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
