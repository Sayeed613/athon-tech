"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  ArrowLeft,
  Pencil,
  RefreshCw,
  AlertCircle,
  Calendar,
  Clock,
  UserRound,
  Building2,
  BookText,
  CheckCircle2,
  FileText,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { homeworkService } from "@/services/homework.service";
import { cn } from "@/lib/utils";

export default function HomeworkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const homeworkId = params.id as string;

  const [gradeTarget, setGradeTarget] = useState<{ id: string; studentName: string; currentScore?: number } | null>(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeRemarks, setGradeRemarks] = useState("");

  const { data: hw, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.homework.detail(homeworkId),
    queryFn: () => homeworkService.get(homeworkId),
    enabled: !!homeworkId,
  });

  const submissionsQuery = useQuery({
    queryKey: queryKeys.homework.submissions(homeworkId),
    queryFn: () => homeworkService.getSubmissions(homeworkId),
    enabled: !!homeworkId,
  });

  const submissions = submissionsQuery.data?.submissions ?? [];

  const stats = useMemo(() => {
    const total = submissions.length;
    const submitted = submissions.filter((s) => s.status === "submitted" || s.status === "graded").length;
    const graded = submissions.filter((s) => s.is_graded).length;
    const pending = total - submitted;
    const scores = submissions.filter((s) => s.total_score != null).map((s) => s.total_score!);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { total, submitted, graded, pending, avgScore: Math.round(avgScore * 100) / 100 };
  }, [submissions]);

  const gradeMutation = useMutation({
    mutationFn: ({ submissionId, score, remarks }: { submissionId: string; score: number; remarks?: string }) =>
      homeworkService.gradeSubmission(homeworkId, submissionId, { total_score: score, teacher_remarks: remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.homework.submissions(homeworkId) });
      toast({ title: "Graded", description: "Submission graded successfully." });
      setGradeTarget(null);
      setGradeScore("");
      setGradeRemarks("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to grade", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <Skeleton className="h-8 w-64" />
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  if (isError || !hw) {
    return (
      <AdminLayout>
        <ContentContainer>
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-destructive">Homework not found or failed to load.</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/homework")}>
              Back to Homework
            </Button>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  const isOverdue = new Date(hw.due_date) < new Date();

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title={hw.title}
          description={`Homework • ${hw.class_?.name ?? "—"} • ${hw.subject?.name ?? "—"}`}
        >
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/homework")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/homework/${homeworkId}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </PageHeader>

        {/* Status & Meta */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge variant={hw.is_published ? "default" : "outline"}>
            {hw.is_published ? "Published" : "Draft"}
          </Badge>
          {isOverdue && hw.is_published && <Badge variant="destructive">Overdue</Badge>}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Due {new Date(hw.due_date).toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <BookText className="h-3 w-3" /> {hw.max_score} pts
          </span>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Students</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Submitted</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.submitted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Graded</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{stats.graded}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.avgScore}</p>
            </CardContent>
          </Card>
        </div>

        {/* Teacher & Class Info */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <UserRound className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Teacher</p>
                <p className="text-sm font-medium">{hw.teacher?.name ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Class</p>
                <p className="text-sm font-medium">{hw.class_?.name ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Subject</p>
                <p className="text-sm font-medium">{hw.subject?.name ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Description */}
        {hw.description && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{hw.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Submissions Tab */}
        <div className="mt-6">
          <Tabs defaultValue="submissions">
            <TabsList>
              <TabsTrigger value="submissions" className="gap-2">
                <FileText className="h-4 w-4" /> Submissions ({submissions.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="submissions" className="mt-4">
              {submissionsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : submissions.length === 0 ? (
                <EmptyState variant="no-data" title="No submissions" description="No students have submitted yet." />
              ) : (
                <div className="space-y-2">
                  {submissions.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {sub.student?.first_name?.[0]}{sub.student?.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {sub.student?.first_name} {sub.student?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sub.student?.admission_number} — {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "Not submitted"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {sub.is_graded ? (
                          <Badge variant="default" className="gap-1">
                            <Check className="h-3 w-3" /> {sub.total_score}/{hw.max_score}
                          </Badge>
                        ) : sub.status === "submitted" ? (
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                            setGradeTarget({
                              id: sub.id,
                              studentName: `${sub.student?.first_name} ${sub.student?.last_name}`,
                              currentScore: sub.total_score ?? undefined,
                            });
                            setGradeScore(sub.total_score?.toString() ?? "");
                          }}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Grade
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="capitalize">{sub.status.replace("_", " ")}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Grade Dialog */}
        <Dialog open={!!gradeTarget} onOpenChange={(o) => { if (!o) setGradeTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grade Submission</DialogTitle>
              <DialogDescription>
                {gradeTarget?.studentName} — Score out of {hw.max_score}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Score <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  max={hw.max_score}
                  step={0.5}
                  value={gradeScore}
                  onChange={(e) => setGradeScore(e.target.value)}
                  placeholder={`0 - ${hw.max_score}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Remarks (optional)</Label>
                <Textarea
                  value={gradeRemarks}
                  onChange={(e) => setGradeRemarks(e.target.value)}
                  placeholder="Feedback for the student..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGradeTarget(null)} disabled={gradeMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => gradeTarget && gradeMutation.mutate({
                  submissionId: gradeTarget.id,
                  score: parseFloat(gradeScore),
                  remarks: gradeRemarks || undefined,
                })}
                disabled={gradeMutation.isPending || !gradeScore}
                className="gap-2"
              >
                {gradeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Submit Grade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
