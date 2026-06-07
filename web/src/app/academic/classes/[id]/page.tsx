"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Ban,
  CheckCircle2,
  Building2,
  Users,
  BookOpen,
  UserRound,
  CalendarRange,
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  Hash,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { classService } from "@/services/class.service";
import { useState } from "react";

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const classId = params?.id as string;

  // ── Query ───────────────────────────────────────────────────
  const {
    data: cls,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.classes.detail(classId),
    queryFn: () => classService.get(classId),
    enabled: !!classId,
  });

  // ── Archive Mutation ────────────────────────────────────────
  const archiveMutation = useMutation({
    mutationFn: () => classService.archive(classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.detail(classId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast({ title: "Class archived", description: "The class has been archived." });
      setShowArchiveDialog(false);
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Operation failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Loading State ───────────────────────────────────────────
  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="mt-1 h-4 w-32" />
            </div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  // ── Error State ─────────────────────────────────────────────
  if (isError || !cls) {
    return (
      <AdminLayout>
        <ContentContainer>
          <PageHeader title="Class not found" description="The class could not be loaded." />
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Class not found or you don't have access."}
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
              </Button>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            </div>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ContentContainer>
        {/* Back Link */}
        <Link
          href="/academic/classes"
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Classes
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {cls.name}{cls.section ? <span className="text-muted-foreground"> - {cls.section}</span> : null}
                </h1>
                <Badge className="bg-success/15 text-success hover:bg-success/20 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{cls.academic_year_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => router.push(`/academic/classes/${cls.id}/edit`)}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => setShowArchiveDialog(true)}
            >
              <Ban className="h-4 w-4" /> Archive
            </Button>
          </div>
        </div>

        {/* Content Grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Class Name</p>
                    <p className="text-sm font-medium">{cls.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Section</p>
                    <p className="text-sm font-medium">{cls.section ?? <span className="italic text-muted-foreground">Not specified</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Academic Year</p>
                    <p className="text-sm font-medium">{cls.academic_year_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Room Number</p>
                    <p className="text-sm font-medium">{cls.room_number ?? <span className="italic text-muted-foreground">Not assigned</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Class Teacher</p>
                    <p className="text-sm font-medium">
                      {cls.class_teacher_name ?? <span className="italic text-muted-foreground">Not assigned</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Capacity</p>
                    <p className="text-sm font-medium">{cls.capacity} students</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Teachers & Subjects */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Teachers & Subjects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  variant="no-data"
                  title="No assignments yet"
                  description="Teachers and subjects will appear here once assigned."
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="h-4 w-4 text-primary" />
                  Class Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Enrolled Students</p>
                    <p className="text-lg font-semibold">{cls.student_count} / {cls.capacity}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <UserRound className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned Teachers</p>
                    <p className="text-lg font-semibold">—</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <CalendarRange className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Timetable</p>
                    <p className="text-sm font-medium">Not configured</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => router.push(`/academic/classes/${cls.id}/edit`)}
                >
                  <Pencil className="h-4 w-4" /> Edit Class
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => router.push("/timetable")}
                >
                  <CalendarRange className="h-4 w-4" /> Manage Timetable
                </Button>
              </CardContent>
            </Card>

            {/* Timestamps */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Timestamps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">{cls.created_at ? format(new Date(cls.created_at), "MMM d, yyyy") : "—"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{cls.updated_at ? format(new Date(cls.updated_at), "MMM d, yyyy") : "—"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Archive Dialog */}
        <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Archive Class
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to archive {cls.name}{cls.section ? ` - ${cls.section}` : ""}?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowArchiveDialog(false)} disabled={archiveMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
              >
                {archiveMutation.isPending ? "Archiving..." : "Archive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
