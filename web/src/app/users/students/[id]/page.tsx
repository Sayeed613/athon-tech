"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Ban, CheckCircle2, Mail, Phone, Calendar, ShieldAlert,
  RefreshCw, AlertCircle, BadgeCheck, Hash, BookOpen, Users, GraduationCap,
  TrendingUp, UserRound, BookMarked,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { studentService } from "@/services/student.service";
import type { StudentParentInfo, StudentEnrollmentInfo } from "@/types/student";

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const studentId = params?.id as string;

  // ── Student Query ──────────────────────────────────────────
  const { data: student, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.students.detail(studentId),
    queryFn: () => studentService.get(studentId),
    enabled: !!studentId,
  });

  // ── Student Report Query ───────────────────────────────────
  const { data: report } = useQuery({
    queryKey: queryKeys.reports.student(studentId),
    queryFn: () => studentService.getReport(studentId),
    enabled: !!studentId,
  });

  // ── Deactivation Mutation ──────────────────────────────────
  const deactivateMutation = useMutation({
    mutationFn: () => studentService.deactivate(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(studentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      toast({ title: student?.is_active ? "Student deactivated" : "Student reactivated", description: "Account status updated." });
      setShowDeactivateDialog(false);
      refetch();
    },
    onError: (err: Error) => toast({ title: "Operation failed", description: err.message, variant: "destructive" }),
  });

  // ── Loading ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <Skeleton className="h-6 w-48" />
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {Array.from({ length: 2 }).map((_, i) => (<Skeleton key={i} className="h-48 w-full rounded-xl" />))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (isError || !student) {
    return (
      <AdminLayout>
        <ContentContainer>
          <PageHeader title="Student not found" description="The student profile could not be loaded." />
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Student not found or you don't have access."}</p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
              <Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
            </div>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  const s = student;
  const initials = `${s.first_name.charAt(0)}${s.last_name.charAt(0)}`.toUpperCase();
  const fullName = `${s.first_name} ${s.last_name}`;

  return (
    <AdminLayout>
      <ContentContainer>
        <Link href="/users/students" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Students
        </Link>

        {/* Profile Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg bg-primary/10 text-primary">{initials || "?"}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
                <Badge variant={s.is_active ? "default" : "secondary"} className={s.is_active ? "bg-success/15 text-success hover:bg-success/20 gap-1" : "gap-1"}>
                  {s.is_active ? <><CheckCircle2 className="h-3 w-3" /> Active</> : <><Ban className="h-3 w-3" /> Inactive</>}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{s.admission_number}{s.class_name ? ` · ${s.class_name}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/users/students/${s.id}/edit`)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant={s.is_active ? "destructive" : "default"} size="sm" className="gap-2" onClick={() => setShowDeactivateDialog(true)}>
              {s.is_active ? <><Ban className="h-4 w-4" /> Deactivate</> : <><CheckCircle2 className="h-4 w-4" /> Reactivate</>}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="mt-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2"><UserRound className="h-4 w-4" /> Profile</TabsTrigger>
            <TabsTrigger value="parents" className="gap-2"><Users className="h-4 w-4" /> Parents</TabsTrigger>
            <TabsTrigger value="enrollments" className="gap-2"><BookMarked className="h-4 w-4" /> Enrollments</TabsTrigger>
            <TabsTrigger value="academic" className="gap-2"><TrendingUp className="h-4 w-4" /> Academic Summary</TabsTrigger>
          </TabsList>

          {/* Tab: Profile */}
          <TabsContent value="profile" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /> Profile Information</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div><p className="text-xs text-muted-foreground">First Name</p><p className="text-sm font-medium">{s.first_name}</p></div>
                      <div><p className="text-xs text-muted-foreground">Last Name</p><p className="text-sm font-medium">{s.last_name}</p></div>
                      <div><p className="text-xs text-muted-foreground">Admission Number</p><p className="text-sm font-medium">{s.admission_number}</p></div>
                      <div><p className="text-xs text-muted-foreground">Roll Number</p><p className="text-sm font-medium">{s.roll_number ?? <span className="italic text-muted-foreground">Not assigned</span>}</p></div>
                      <div><p className="text-xs text-muted-foreground">Date of Birth</p><p className="text-sm font-medium">{s.date_of_birth ? format(new Date(s.date_of_birth), "MMM d, yyyy") : <span className="italic text-muted-foreground">Not recorded</span>}</p></div>
                      <div><p className="text-xs text-muted-foreground">Gender</p><p className="text-sm font-medium capitalize">{s.gender ?? <span className="italic text-muted-foreground">Not specified</span>}</p></div>
                      <div><p className="text-xs text-muted-foreground">Enrollment Date</p><p className="text-sm font-medium">{s.enrollment_date ? format(new Date(s.enrollment_date), "MMM d, yyyy") : "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Current Class</p><p className="text-sm font-medium">{s.class_name || <span className="italic text-muted-foreground">Not enrolled</span>}</p></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Contact Information</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Mail className="h-4 w-4 text-primary" /></div>
                        <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-medium">{s.email}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Phone className="h-4 w-4 text-primary" /></div>
                        <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-medium">{s.phone ?? <span className="italic text-muted-foreground">Not provided</span>}</p></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Hash className="h-4 w-4 text-primary" /> Account Details</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-muted-foreground shrink-0" /><div><p className="text-xs text-muted-foreground">Created</p><p className="text-sm">{s.created_at ? format(new Date(s.created_at), "MMM d, yyyy") : "—"}</p></div></div>
                    <Separator />
                    <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-muted-foreground shrink-0" /><div><p className="text-xs text-muted-foreground">Last Updated</p><p className="text-sm">{s.updated_at ? format(new Date(s.updated_at), "MMM d, yyyy") : "—"}</p></div></div>
                    <Separator />
                    <div className="flex items-center gap-3"><GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" /><div><p className="text-xs text-muted-foreground">Role</p><p className="text-sm capitalize">Student</p></div></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={() => router.push(`/users/students/${s.id}/edit`)}>
                      <Pencil className="h-4 w-4" /> Edit Profile
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Parents */}
          <TabsContent value="parents" className="mt-6">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Linked Parents</CardTitle></CardHeader>
              <CardContent>
                {s.parents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Users className="mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No parents linked to this student.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {s.parents.map((p: StudentParentInfo) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{p.parent_name.charAt(0) || "?"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{p.parent_name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{p.relationship}</p>
                          </div>
                        </div>
                        {p.is_primary_contact && (
                          <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">Primary Contact</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Enrollments */}
          <TabsContent value="enrollments" className="mt-6">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookMarked className="h-4 w-4 text-primary" /> Enrollment History</CardTitle></CardHeader>
              <CardContent>
                {s.enrollments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <BookMarked className="mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No enrollment history available.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {s.enrollments.map((e: StudentEnrollmentInfo) => (
                      <div key={e.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <BookMarked className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{e.class_name}</p>
                            <p className="text-xs text-muted-foreground">{e.academic_year_name}{e.enrolled_at ? ` · Enrolled ${format(new Date(e.enrolled_at), "MMM d, yyyy")}` : ""}</p>
                          </div>
                        </div>
                        <Badge variant={e.status === "active" ? "default" : "secondary"} className="text-[10px] capitalize">
                          {e.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Academic Summary */}
          <TabsContent value="academic" className="mt-6">
            {!report ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  {report === undefined
                    ? <><TrendingUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p>Loading academic summary...</p></>
                    : <><AlertCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p>Academic summary not yet available.</p></>
                  }
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Attendance */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Attendance</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{report.attendance_present_percentage.toFixed(1)}%</div>
                    <p className="mt-1 text-xs text-muted-foreground">{report.attendance_total_records} records</p>
                  </CardContent>
                </Card>
                {/* Homework */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Homework</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{report.homework_completion_rate.toFixed(1)}%</div>
                    <p className="mt-1 text-xs text-muted-foreground">{report.homework_submitted}/{report.homework_total_assigned} completed · Avg {report.homework_average_score.toFixed(1)}%</p>
                  </CardContent>
                </Card>
                {/* Tests */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Tests</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{report.tests_pass_rate.toFixed(1)}%</div>
                    <p className="mt-1 text-xs text-muted-foreground">{report.tests_attempted}/{report.tests_total} attempted · Avg {report.tests_average_score.toFixed(1)}%</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Deactivate/Reactivate Dialog */}
        <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" /> {s.is_active ? "Deactivate Student" : "Reactivate Student"}</DialogTitle>
              <DialogDescription>
                {s.is_active ? `Are you sure you want to deactivate ${fullName}?` : `Are you sure you want to reactivate ${fullName}?`}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">{s.is_active ? "This can be reversed at any time. No data will be lost." : "The student will regain access to their account."}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeactivateDialog(false)} disabled={deactivateMutation.isPending}>Cancel</Button>
              <Button variant={s.is_active ? "destructive" : "default"} onClick={() => deactivateMutation.mutate()} disabled={deactivateMutation.isPending}>
                {deactivateMutation.isPending ? "Processing..." : s.is_active ? "Deactivate" : "Reactivate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
