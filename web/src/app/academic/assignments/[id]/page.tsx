"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  UserRound,
  Building2,
  BookOpen,
  CalendarCheck,
  Calendar,
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  CalendarRange,
  GraduationCap,
  CheckCircle2,
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
import { assignmentService } from "@/services/assignment.service";
import { useState } from "react";

export default function AssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const assignmentId = params?.id as string;

  // ── Query ───────────────────────────────────────────────────
  const { data: listData, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.assignments.list(),
    queryFn: () => assignmentService.list(),
    enabled: !!assignmentId,
    staleTime: 30_000,
  });

  const assignment = listData?.assignments.find((a) => a.id === assignmentId) ?? null;

  // ── Remove Mutation ─────────────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: () => assignmentService.remove(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all });
      toast({ title: "Assignment removed", description: "The assignment has been removed." });
      router.push("/academic/assignments");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    },
  });

  // ── Loading ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <Skeleton className="h-6 w-48" />
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (isError || !assignment) {
    return (
      <AdminLayout>
        <ContentContainer>
          <PageHeader title="Assignment not found" description="The assignment could not be loaded." />
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Assignment not found."}
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => router.push("/academic/assignments")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Assignments
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

  const a = assignment;

  return (
    <AdminLayout>
      <ContentContainer>
        <Link
          href="/academic/assignments"
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Assignments
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
              <UserRound className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{a.teacher_name}</h1>
                {a.is_class_teacher && (
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/20 gap-1">
                    <GraduationCap className="h-3 w-3" /> Class Teacher
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{a.teacher_code}</p>
            </div>
          </div>

          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={() => setShowRemoveDialog(true)}
          >
            <Trash2 className="h-4 w-4" /> Remove Assignment
          </Button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Class & Subject Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Class & Subject
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Class</p>
                      <p className="text-sm font-medium">
                        {a.class_name}{a.class_section ? ` - ${a.class_section}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Subject</p>
                      <p className="text-sm font-medium">{a.subject_name}</p>
                      <p className="text-xs text-muted-foreground">{a.subject_code}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Teacher Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-primary" /> Teacher Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <UserRound className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-base font-medium">{a.teacher_name}</p>
                    <p className="text-sm text-muted-foreground">Employee Code: {a.teacher_code}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Assignment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-primary" /> Assignment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Academic Term</p>
                    <p className="text-sm font-medium">{a.academic_term_name}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Academic Year</p>
                    <p className="text-sm font-medium">{a.academic_year_name}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Class Teacher</p>
                    <p className="text-sm font-medium">{a.is_class_teacher ? "Yes" : "No"}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Timetable Entries</p>
                    <p className="text-sm font-medium">—</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <Badge className="bg-success/15 text-success hover:bg-success/20 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </Badge>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-xs text-muted-foreground">Created date not available from API</p>
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
                  onClick={() => router.push(`/users/teachers/${a.teacher_id}`)}
                >
                  <UserRound className="h-4 w-4" /> View Teacher Profile
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => router.push(`/academic/classes/${a.class_id}`)}
                >
                  <Building2 className="h-4 w-4" /> View Class
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Remove Dialog */}
        <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" /> Remove Assignment
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to remove <strong>{a.teacher_name}</strong> from{" "}
                <strong>{a.class_name}</strong> for <strong>{a.subject_name}</strong>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRemoveDialog(false)} disabled={removeMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => removeMutation.mutate()}
                disabled={removeMutation.isPending}
              >
                {removeMutation.isPending ? "Removing..." : "Remove"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
