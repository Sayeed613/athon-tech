"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Ban,
  CheckCircle2,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  GraduationCap,
  Building2,
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  BadgeCheck,
  Hash,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { teacherService } from "@/services/teacher.service";
import type { TeacherAssignment } from "@/types/teacher";

export default function TeacherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const teacherId = params?.id as string;

  // ── Query ───────────────────────────────────────────────────
  const {
    data: teacher,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.teachers.detail(teacherId),
    queryFn: () => teacherService.get(teacherId),
    enabled: !!teacherId,
  });

  // ── Deactivation Mutation ───────────────────────────────────
  const deactivateMutation = useMutation({
    mutationFn: () => teacherService.deactivate(teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.teachers.detail(teacherId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all });
      toast({
        title: teacher?.is_active
          ? "Teacher deactivated"
          : "Teacher reactivated",
        description: teacher?.is_active
          ? "The teacher account has been deactivated."
          : "The teacher account has been reactivated.",
      });
      setShowDeactivateDialog(false);
      refetch();
    },
    onError: (err: Error) => {
      toast({
        title: "Operation failed",
        description: err.message,
        variant: "destructive",
      });
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
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  // ── Error State ─────────────────────────────────────────────
  if (isError || !teacher) {
    return (
      <AdminLayout>
        <ContentContainer>
          <PageHeader
            title="Teacher not found"
            description="The teacher profile could not be loaded."
          />
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-sm text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Teacher not found or you don't have access."}
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  const t = teacher;
  const initials = `${t.first_name.charAt(0)}${t.last_name.charAt(0)}`.toUpperCase();
  const fullName = `${t.first_name} ${t.last_name}`;

  return (
    <AdminLayout>
      <ContentContainer>
        {/* ── Back Link ────────────────────────────────────────── */}
        <Link
          href="/users/teachers"
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Teachers
        </Link>

        {/* ── Profile Header ──────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {fullName}
                </h1>
                <Badge
                  variant={t.is_active ? "default" : "secondary"}
                  className={t.is_active ? "bg-success/15 text-success hover:bg-success/20 gap-1" : "gap-1"}
                >
                  {t.is_active ? (
                    <><CheckCircle2 className="h-3 w-3" /> Active</>
                  ) : (
                    <><Ban className="h-3 w-3" /> Inactive</>
                  )}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.employee_code}
                {t.is_class_teacher && " · Class Teacher"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                router.push(`/users/teachers/${t.id}/edit`)
              }
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant={t.is_active ? "destructive" : "default"}
              size="sm"
              className="gap-2"
              onClick={() => setShowDeactivateDialog(true)}
            >
              {t.is_active ? (
                <><Ban className="h-4 w-4" /> Deactivate</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Reactivate</>
              )}
            </Button>
          </div>
        </div>

        {/* ── Content Grid ────────────────────────────────────── */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left column — Profile & Contact */}
          <div className="space-y-6 lg:col-span-2">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">First Name</p>
                    <p className="text-sm font-medium">{t.first_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Name</p>
                    <p className="text-sm font-medium">{t.last_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Employee Code</p>
                    <p className="text-sm font-medium">{t.employee_code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Qualification</p>
                    <p className="text-sm font-medium">
                      {t.qualification ?? (
                        <span className="italic text-muted-foreground">
                          Not specified
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Specialization</p>
                    <p className="text-sm font-medium">
                      {t.specialization ?? (
                        <span className="italic text-muted-foreground">
                          Not specified
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hire Date</p>
                    <p className="text-sm font-medium">
                      {t.hire_date
                        ? format(new Date(t.hire_date), "MMM d, yyyy")
                        : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{t.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium">
                        {t.phone ?? (
                          <span className="italic text-muted-foreground">
                            Not provided
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assigned Classes & Subjects */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Classes & Subjects
                </CardTitle>
              </CardHeader>
              <CardContent>
                {t.assignments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <GraduationCap className="mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No classes or subjects assigned yet.
                    </p>
                    <Link
                      href="/academic/assignments"
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Assign classes and subjects
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {t.assignments.map((assignment: TeacherAssignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {assignment.class_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {assignment.subject_name}
                            </p>
                          </div>
                        </div>
                        {assignment.is_class_teacher && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-primary/20 text-primary"
                          >
                            Class Teacher
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column — Meta & Quick Info */}
          <div className="space-y-6">
            {/* Account Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="h-4 w-4 text-primary" />
                  Account Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm">
                      {t.created_at
                        ? format(new Date(t.created_at), "MMM d, yyyy")
                        : "—"}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="text-sm">
                      {t.updated_at
                        ? format(new Date(t.updated_at), "MMM d, yyyy")
                        : "—"}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Role</p>
                    <p className="text-sm capitalize">Teacher</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <BadgeCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Class Teacher</p>
                    <p className="text-sm">
                      {t.is_class_teacher ? "Yes" : "No"}
                    </p>
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
                  onClick={() => router.push("/academic/assignments")}
                >
                  <BookOpen className="h-4 w-4" />
                  Manage Assignments
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => router.push(`/users/teachers/${t.id}/edit`)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Profile
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Deactivate/Reactivate Dialog ────────────────────── */}

        <Dialog
          open={showDeactivateDialog}
          onOpenChange={setShowDeactivateDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                {t.is_active ? "Deactivate Teacher" : "Reactivate Teacher"}
              </DialogTitle>
              <DialogDescription>
                {t.is_active
                  ? `Are you sure you want to deactivate ${fullName}? They will lose access to their account.`
                  : `Are you sure you want to reactivate ${fullName}? They will regain access to their account.`}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                {t.is_active
                  ? "This action can be reversed at any time. No data will be lost."
                  : "The teacher will be able to log in and access their assigned classes and subjects."}
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeactivateDialog(false)}
                disabled={deactivateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant={t.is_active ? "destructive" : "default"}
                onClick={() => deactivateMutation.mutate()}
                disabled={deactivateMutation.isPending}
                className="gap-2"
              >
                {deactivateMutation.isPending
                  ? "Processing..."
                  : t.is_active
                  ? "Deactivate"
                  : "Reactivate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
