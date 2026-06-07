"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  RefreshCw,
  AlertCircle,
  CheckCheck,
  CheckCircle2,
  Mail,
  MailOpen,
  Inbox,
  Loader2,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { notificationService } from "@/services/notifications.service";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/types/notifications";

const TYPE_COLORS: Record<string, string> = {
  academic: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  attendance: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  fee_reminder: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  announcement: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  behavioral: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  emergency: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  system: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");

  // Fetch notifications
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: () => notificationService.getMyNotifications({
      limit: 200,
      unread_only: unreadOnly || undefined,
    }),
    staleTime: 15_000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;

  // Filter by type client-side
  const filtered = typeFilter === "all"
    ? notifications
    : notifications.filter((n) => n.notification_type === typeFilter);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to mark as read", description: err.message, variant: "destructive" });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      toast({ title: "All read", description: `${result.count} notifications marked as read.` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60_000) return "Just now";
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="Notifications"
          description={`${unreadCount} unread · ${notifications.length} total`}
        >
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                {markAllReadMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                Mark All Read
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </PageHeader>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border p-0.5 bg-muted">
            <Button
              variant={!unreadOnly ? "default" : "ghost"}
              size="sm"
              onClick={() => setUnreadOnly(false)}
              className="rounded-md px-3"
            >
              <Inbox className="mr-1.5 h-4 w-4" /> All
            </Button>
            <Button
              variant={unreadOnly ? "default" : "ghost"}
              size="sm"
              onClick={() => setUnreadOnly(true)}
              className="rounded-md px-3"
            >
              <Mail className="mr-1.5 h-4 w-4" /> Unread
              {unreadCount > 0 && (
                <Badge className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">{unreadCount}</Badge>
              )}
            </Button>
          </div>

          <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="academic">Academic</SelectItem>
              <SelectItem value="attendance">Attendance</SelectItem>
              <SelectItem value="announcement">Announcement</SelectItem>
              <SelectItem value="fee_reminder">Fee Reminder</SelectItem>
              <SelectItem value="behavioral">Behavioral</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          {unreadCount > 0 && (
            <Badge variant="default" className="gap-1">
              <Mail className="h-3 w-3" /> {unreadCount} unread
            </Badge>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="mt-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive flex-1">Failed to load notifications.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState
            variant="no-data"
            title={unreadOnly ? "No unread notifications" : "No notifications"}
            description={unreadOnly ? "You're all caught up!" : "No notifications yet. Notifications will appear here when you receive them."}
            icon={unreadOnly ? CheckCheck : Bell}
          />
        )}

        {/* Notifications List */}
        {!isLoading && !isError && filtered.length > 0 && (
          <div className="mt-6 space-y-1">
            {filtered.map((notif) => {
              const isUnread = notif.recipient && !notif.recipient.is_read;
              return (
                <div
                  key={notif.id}
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4 transition-colors cursor-pointer hover:bg-accent/30",
                    isUnread && "border-l-2 border-l-primary bg-primary/[0.02]"
                  )}
                  onClick={() => {
                    if (isUnread && notif.recipient?.user_id) {
                      markReadMutation.mutate(notif.id);
                    }
                  }}
                >
                  {/* Icon */}
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    isUnread ? "bg-primary/10" : "bg-muted"
                  )}>
                    {isUnread ? (
                      <Mail className="h-5 w-5 text-primary" />
                    ) : (
                      <MailOpen className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn("text-sm", isUnread ? "font-semibold" : "font-medium text-muted-foreground")}>
                          {notif.title}
                        </p>
                        {notif.body && (
                          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{notif.body}</p>
                        )}
                      </div>
                      {isUnread && (
                        <div className="flex h-2 w-2 shrink-0 rounded-full bg-primary mt-1.5" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge
                        className={cn(
                          "text-[10px] px-1.5 py-0 capitalize border-0",
                          TYPE_COLORS[notif.notification_type] || TYPE_COLORS.other
                        )}
                      >
                        {notif.notification_type.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(notif.created_at)}</span>
                      {notif.recipient?.is_read && notif.recipient.read_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Read
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ContentContainer>
    </AdminLayout>
  );
}
