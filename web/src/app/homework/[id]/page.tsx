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
  Send,
  HelpCircle,
  ListChecks,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useUserRole } from "@/hooks/use-auth";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { homeworkService } from "@/services/homework.service";
import { cn } from "@/lib/utils";
import type { AIQuestion } from "@/types/dashboard";

// ── Student Homework View ─────────────────────────────────────

function StudentHomeworkView({ homeworkId }: { homeworkId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewState, setViewState] = useState<"detail" | "questions" | "submitted">("detail");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch homework detail
  const { data: hw, isLoading, isError } = useQuery({
    queryKey: queryKeys.homework.detail(homeworkId),
    queryFn: () => homeworkService.get(homeworkId),
    enabled: !!homeworkId,
  });

  // Fetch questions
  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: [...queryKeys.homework.detail(homeworkId), "questions"],
    queryFn: () => homeworkService.getQuestions(homeworkId),
    enabled: viewState === "questions" && !!homeworkId,
  });

  // Check if already submitted via dedicated student endpoint
  const { data: mySubmission } = useQuery({
    queryKey: [...queryKeys.homework.detail(homeworkId), "my-submission"],
    queryFn: () => homeworkService.getMySubmission(homeworkId),
    enabled: !!homeworkId,
  });

  const submitMutation = useMutation({
    mutationFn: () => homeworkService.submitHomework(homeworkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.homework.detail(homeworkId) });
      toast({ title: "Submitted!", description: "Your homework has been submitted successfully." });
      setViewState("submitted");
      setShowConfirm(false);
    },
    onError: (err: Error) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  const isAlreadySubmitted = mySubmission?.status === "submitted" || mySubmission?.status === "graded";

  if (isLoading) {
    return (
      <ContentContainer>
        <Skeleton className="h-8 w-64" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </ContentContainer>
    );
  }

  if (isError || !hw) {
    return (
      <ContentContainer>
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="flex-1 text-destructive">Homework not found or failed to load.</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/homework")}>
            Back to Homework
          </Button>
        </div>
      </ContentContainer>
    );
  }

  const isOverdue = new Date(hw.due_date) < new Date();

  // Submitted / Graded view
  if (isAlreadySubmitted || viewState === "submitted") {
    return (
      <ContentContainer>
        <PageHeader
          title={hw.title}
          description={`${hw.subject?.name ?? "—"} · ${hw.class_?.name ?? "—"}`}
        >
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/homework")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <Card className="mt-6">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-semibold">
              {mySubmission?.is_graded ? "Homework Graded" : "Homework Submitted"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {mySubmission?.submitted_at
                ? `Submitted on ${new Date(mySubmission.submitted_at).toLocaleString()}`
                : "Your submission has been recorded."}
            </p>
            {mySubmission?.is_graded && mySubmission?.total_score != null && (
              <div className="mt-6">
                <p className="text-3xl font-bold text-primary">
                  {mySubmission.total_score} / {hw.max_score}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Your score</p>
              </div>
            )}
            {mySubmission?.teacher_remarks && (
              <div className="mt-4 max-w-md mx-auto rounded-lg bg-muted p-4 text-left">
                <p className="text-xs font-medium text-muted-foreground mb-1">Teacher's remarks:</p>
                <p className="text-sm">{mySubmission.teacher_remarks}</p>
              </div>
            )}
            <Button variant="outline" className="mt-8" onClick={() => router.push("/homework")}>
              Back to Homework List
            </Button>
          </CardContent>
        </Card>
      </ContentContainer>
    );
  }

  // Questions view
  if (viewState === "questions") {
    const unansweredCount = questions?.filter((q) => !answers[q.id]).length ?? 0;

    return (
      <ContentContainer>
        <PageHeader
          title={hw.title}
          description="Answer the questions below and submit."
        >
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setViewState("detail")}>
            <ArrowLeft className="h-4 w-4" /> Back to Details
          </Button>
        </PageHeader>

        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Due {new Date(hw.due_date).toLocaleString()}</span>
          <span className="mx-2">·</span>
          <ListChecks className="h-4 w-4" />
          <span>{questions?.length ?? 0} questions</span>
          {unansweredCount > 0 && (
            <>
              <span className="mx-2">·</span>
              <span className="text-amber-600 font-medium">{unansweredCount} unanswered</span>
            </>
          )}
        </div>

        {questionsLoading ? (
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : questions && questions.length > 0 ? (
          <div className="mt-6 space-y-4">
            {questions.map((q, idx) => (
              <Card key={q.id || idx}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                      <span>{q.question_text}</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                      {q.question_type === "multiple_choice" ? "MCQ" :
                       q.question_type === "true_false" ? "T/F" :
                       q.question_type === "short_answer" ? "Short" :
                       q.question_type === "long_answer" ? "Long" : "Essay"}
                      {" · "}{q.max_points} pts
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {(q.question_type === "multiple_choice" || q.question_type === "true_false") && q.options ? (
                    <RadioGroup
                      value={answers[q.id] ?? ""}
                      onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    >
                      {q.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                          <RadioGroupItem value={opt} id={`q-${q.id}-${i}`} />
                          <Label htmlFor={`q-${q.id}-${i}`} className="flex-1 cursor-pointer text-sm">
                            {opt}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <Textarea
                      placeholder="Type your answer here..."
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      rows={3}
                      className="resize-y"
                    />
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Submit */}
            <div className="sticky bottom-4 flex items-center justify-between rounded-lg border bg-background p-4 shadow-lg">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {questions.length - unansweredCount}
                </span> of {questions.length} answered
              </p>
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={submitMutation.isPending}
                className="gap-2"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Homework
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState variant="no-data" title="No questions" description="This homework has no questions yet." />
        )}

        {/* Confirm Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Homework</DialogTitle>
              <DialogDescription>
                You are about to submit "{hw.title}". {unansweredCount > 0 && (
                  <span className="block mt-1 text-amber-600">
                    Note: {unansweredCount} question{unansweredCount > 1 ? "s" : ""} {" "}
                    {unansweredCount > 1 ? "are" : "is"} unanswered.
                  </span>
                )}
                <span className="block mt-1">You cannot change your answers after submission.</span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={submitMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="gap-2">
                {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirm Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    );
  }

  // Detail view (default)
  return (
    <ContentContainer>
      <PageHeader
        title={hw.title}
        description={`${hw.subject?.name ?? "—"} · ${hw.class_?.name ?? "—"}`}
      >
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/homework")}>
          <ArrowLeft className="h-4 w-4" /> Back
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

      {/* Start Button */}
      <div className="mt-8 text-center">
        <div className="inline-flex flex-col items-center gap-4 rounded-xl border bg-muted/20 p-8">
          <HelpCircle className="h-12 w-12 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Ready to start?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Review the questions and submit your answers before the due date.
            </p>
          </div>
          <Button
            size="lg"
            className="gap-2 min-w-[200px]"
            onClick={() => setViewState("questions")}
            disabled={!hw.is_published}
          >
            <BookOpen className="h-5 w-5" />
            View Questions
          </Button>
          {!hw.is_published && (
            <p className="text-xs text-amber-600">This homework is not yet available.</p>
          )}
        </div>
      </div>
    </ContentContainer>
  );
}

// ── Teacher/Admin Grade View ──────────────────────────────────

function TeacherHomeworkView({ homeworkId }: { homeworkId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      <ContentContainer>
        <Skeleton className="h-8 w-64" />
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </ContentContainer>
    );
  }

  if (isError || !hw) {
    return (
      <ContentContainer>
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="flex-1 text-destructive">Homework not found or failed to load.</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/homework")}>
            Back to Homework
          </Button>
        </div>
      </ContentContainer>
    );
  }

  const isOverdue = new Date(hw.due_date) < new Date();

  return (
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
  );
}

// ── Main Homework Detail Page ─────────────────────────────────

export default function HomeworkDetailPage() {
  const params = useParams();
  const role = useUserRole();
  const homeworkId = params.id as string;

  if (role.isStudent) {
    return (
      <AdminLayout>
        <StudentHomeworkView homeworkId={homeworkId} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <TeacherHomeworkView homeworkId={homeworkId} />
    </AdminLayout>
  );
}
