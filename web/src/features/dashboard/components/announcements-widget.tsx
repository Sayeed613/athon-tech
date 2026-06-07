/** Athon — Announcements Widget */

import { Megaphone, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { AnnouncementItem } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface AnnouncementsWidgetProps {
  announcements: AnnouncementItem[];
}

const priorityColors: Record<string, string> = {
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
  high: "bg-warning/10 text-warning border-warning/20",
  normal: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
};

/**
 * Recent announcements widget for the dashboard.
 * Shows the latest 5 published announcements with priority badges.
 */
export function AnnouncementsWidget({
  announcements,
}: AnnouncementsWidgetProps) {
  if (announcements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Megaphone className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No announcements yet.
        </p>
        <Link
          href="/announcements"
          className="mt-2 text-xs text-primary hover:underline"
        >
          Create your first announcement
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((announcement) => (
        <div
          key={announcement.id}
          className="rounded-md border p-3 transition-colors hover:bg-accent/50"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">
                  {announcement.title}
                </p>
                <Badge
                  variant="outline"
                  className={[
                    "h-5 text-[10px] px-1.5 uppercase tracking-wider font-semibold",
                    priorityColors[announcement.priority] ??
                      priorityColors.normal,
                  ].join(" ")}
                >
                  {announcement.priority}
                </Badge>
              </div>
              {announcement.body && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {announcement.body}
                </p>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              {announcement.created_at
                ? formatDistanceToNow(
                    new Date(announcement.created_at),
                    { addSuffix: true }
                  )
                : ""}
            </p>
          </div>
        </div>
      ))}

      <Link
        href="/announcements"
        className="block text-center text-xs text-primary hover:underline pt-1"
      >
        View all announcements →
      </Link>
    </div>
  );
}
