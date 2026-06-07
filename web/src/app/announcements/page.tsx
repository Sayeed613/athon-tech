"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Plus,
  RefreshCw,
  AlertCircle,
  Trash2,
  Send,
  Calendar,
  Globe,
  ShieldAlert,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useUserRole } from "@/hooks/use-auth";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { classService } from "@/services/class.service";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { announcementService } from "@/services/announcements.service";
import { cn } from "@/lib/utils";
import type { AnnouncementItem } from "@/types/announcements";

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const AUDIENCE_LABELS: Record<string, string> = {
  school_wide: "School Wide",
  teachers_only: "Teachers Only",
  specific_classes: "Specific Classes",
};

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const role = useUserRole();

  const canCreate = role.isAdmin || role.isPrincipal || role.isTeacher;
  const canDelete = role.isAdmin || role.isPrincipal;

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showUnpublished, setShowUnpublished] = useState(false);

  const defaultAudience = (role.isTeacher ? "specific_classes" : "school_wide") as "school_wide" | "teachers_only" | "specific_classes";

  // Create form state
  const [form, setForm] = useState({
    title: "",
    body: "",
    audience_type: defaultAudience,
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    is_published: true,
    class_ids: undefined as string[] | undefined,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.announcements.all,
    queryFn: () => announcementService.list({
      limit: 200,
      include_unpublished: showUnpublished && (role.isAdmin || role.isPrincipal),
    }),
    staleTime: 30_000,
  });

  const announcements = data?.announcements ?? [];

  const { data: classesData } = useQuery({
    queryKey: queryKeys.classes.list({ limit: 200 }),
    queryFn: () => classService.list({ limit: 200 }),
    staleTime: 60_000,
  });
  const classes = classesData?.classes ?? [];

  const createMutation = useMutation({
    mutationFn: () => announcementService.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      toast({ title: "Announcement created", description: "Your announcement has been sent." });
      setShowCreateDialog(false);
      setForm({ title: "", body: "", audience_type: defaultAudience, priority: "normal", is_published: true, class_ids: undefined });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => announcementService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      toast({ title: "Deleted", description: "Announcement has been removed." });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  const getPriorityBadge = (priority: string) => {
    const p = priority || "normal";
    return (
      <Badge className={cn("text-[10px] px-1.5 py-0 capitalize border-0", PRIORITY_COLORS[p] || PRIORITY_COLORS.normal)}>
        {p}
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="Announcements"
          description="Create and manage school-wide announcements and broadcasts."
        >
          <div className="flex items-center gap-2">
            {(role.isAdmin || role.isPrincipal) && (
              <div className="flex items-center gap-2 mr-2">
                <Label htmlFor="show-drafts" className="text-xs text-muted-foreground cursor-pointer">Show drafts</Label>
                <Switch checked={showUnpublished} onCheckedChange={setShowUnpublished} id="show-drafts" />
              </div>
            )}
            {canCreate && (
              <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> New Announcement
              </Button>
            )}
          </div>
        </PageHeader>

        {/* Loading */}
        {isLoading && (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive flex-1">Failed to load announcements.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && announcements.length === 0 && (
          <EmptyState
            variant="no-data"
            title="No announcements"
            description={showUnpublished ? "No announcements found. Create your first one!" : "No published announcements."}
            icon={Megaphone}
            action={canCreate ? { label: "Create Announcement", onClick: () => setShowCreateDialog(true) } : undefined}
          />
        )}

        {/* Announcement List */}
        {!isLoading && !isError && announcements.length > 0 && (
          <div className="mt-6 space-y-3">
            {announcements.map((ann) => {
              const isExpanded = expandedId === ann.id;
              return (
                <Card key={ann.id} className={cn("overflow-hidden transition-colors", !ann.is_published && "border-dashed opacity-70")}>
                  <div
                    className="p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Megaphone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{ann.title}</p>
                            {!ann.is_published && <Badge variant="outline" className="text-[10px]">Draft</Badge>}
                            {getPriorityBadge(ann.priority)}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{ann.sender ? `${ann.sender.first_name} ${ann.sender.last_name}` : "System"}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {formatDate(ann.created_at)}
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1 capitalize">
                              <Globe className="h-3 w-3" /> {AUDIENCE_LABELS[ann.audience_type] || ann.audience_type}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(ann); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Body */}
                  {isExpanded && (
                    <div className="border-t px-4 py-3">
                      {ann.body ? (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ann.body}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No body content.</p>
                      )}
                      {ann.published_at && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Published {formatDate(ann.published_at)}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Create Dialog ──────────────────────────────────── */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" /> New Announcement
              </DialogTitle>
              <DialogDescription>
                Create an announcement that will be sent to the selected audience.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Announcement title"
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={form.body}
                  onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                  placeholder="Write your announcement..."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select
                    value={form.audience_type}
                    onValueChange={(v) => v && setForm((p) => ({ ...p, audience_type: v as typeof form.audience_type }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {role.isTeacher ? (
                        <SelectItem value="specific_classes">Specific Classes</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="school_wide">School Wide</SelectItem>
                          <SelectItem value="teachers_only">Teachers Only</SelectItem>
                          <SelectItem value="specific_classes">Specific Classes</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => v && setForm((p) => ({ ...p, priority: v as typeof form.priority }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.audience_type === "specific_classes" && (
                <div className="space-y-2">
                  <Label>Target Classes <span className="text-destructive">*</span></Label>
                  <Select
                    value={form.class_ids?.[0] || ""}
                    onValueChange={(v) => v && setForm((p) => ({ ...p, class_ids: [v] }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select a class..." /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.section ? ` - ${c.section}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Select one class to send this announcement to.</p>
                </div>
              )}
              <div className="flex items-center gap-3 pt-2">
                <Switch
                  checked={form.is_published}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, is_published: v }))}
                  id="publish-now"
                />
                <Label htmlFor="publish-now" className="cursor-pointer">Publish immediately</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={createMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.title.trim()}
                className="gap-2"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {form.is_published ? "Send" : "Save Draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Dialog ──────────────────────────────────── */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" /> Delete Announcement
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "<strong>{deleteTarget?.title}</strong>"?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="gap-2"
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
