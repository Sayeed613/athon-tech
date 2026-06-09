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
  GripVertical,
  Save,
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
    const unansweredCount = questions?.filter((q) => !answers[q.id ?? '']).length ?? 0;

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

// ── Teacher/Admin View ────────────────────────────────────────

function TeacherHomeworkView({ homeworkId }: { homeworkId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [gradeTarget, setGradeTarget] = useState<{ id: string; studentName: string; currentScore?: number } | null>(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeRemarks, setGradeRemarks] = useState("");

  // Question editing state
  const [editQuestion, setEditQuestion] = useState<{
    id: string;
    question_text: string;
    question_type: string;
    options: string[] | null;
    correct_answer: string | null;
    explanation: string | null;
    max_points: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; text: string } | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    question_text: "",
    question_type: "short_answer",
    options: [] as string[],
    correct_answer: "",
    explanation: "",
    max_points: 5,
  });

  // Reorder state
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<string[]>([]);

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
  const questions = (hw?.questions as Array<Record<string, unknown>>) ?? [];

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
    onError: (err: Error) => { toast({ title: "Failed to grade", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ questionId, payload }: { questionId: string; payload: Record<string, unknown> }) =>
      homeworkService.updateQuestion(homeworkId, questionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.homework.detail(homeworkId) });
      toast({ title: "Updated", description: "Question updated." });
      setEditQuestion(null);
    },
    onError: (err: Error) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (questionId: string) => homeworkService.deleteQuestion(homeworkId, questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.homework.detail(homeworkId) });
      toast({ title: "Deleted", description: "Question removed." });
      setDeleteTarget(null);
    },
    onError: (err: Error) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const addMutation = useMutation({
    mutationFn: () =>
      homeworkService.saveQuestions(homeworkId, [newQuestion as import("@/types/dashboard").AIQuestion]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.homework.detail(homeworkId) });
      toast({ title: "Added", description: "New question added." });
      setIsAddingNew(false);
      setNewQuestion({ question_text: "", question_type: "short_answer", options: [], correct_answer: "", explanation: "", max_points: 5 });
    },
    onError: (err: Error) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const reorderMutation = useMutation({
    mutationFn: (questionIds: string[]) =>
      homeworkService.reorderQuestions(homeworkId, questionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.homework.detail(homeworkId) });
      toast({ title: "Reordered", description: "Question order saved." });
      setIsReorderMode(false);
      setDragIndex(null);
      setDragOverIndex(null);
    },
    onError: (err: Error) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const syncScoreMutation = useMutation({
    mutationFn: (score: number) =>
      homeworkService.update(homeworkId, { max_score: score }),
    onSuccess: (_, score) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.homework.detail(homeworkId) });
      toast({ title: "Synced", description: `Max score updated to ${score} pts from question totals.` });
    },
    onError: (err: Error) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  // Calculate total points from questions
  const totalQuestionPoints = useMemo(() => {
    return questions.reduce((sum: number, q: Record<string, unknown>) => sum + ((q.max_points as number) || 0), 0);
  }, [questions]);

  const isScoreOutOfSync = questions.length > 0 && totalQuestionPoints !== hw?.max_score;

  if (isLoading) {
    return (
      <ContentContainer>
        <Skeleton className="h-8 w-64" />
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" /><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-32 rounded-xl" />
        </div>
      </ContentContainer>
    );
  }

  if (isError || !hw) {
    return (
      <ContentContainer>
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="flex-1 text-destructive">Homework not found.</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/homework")}>Back</Button>
        </div>
      </ContentContainer>
    );
  }

  const isOverdue = new Date(hw.due_date) < new Date();

  const QuestionEditDialog = () => (
    <Dialog open={!!editQuestion} onOpenChange={(o) => { if (!o) setEditQuestion(null); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
          <DialogDescription>Update the question details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Question Text <span className="text-destructive">*</span></Label>
            <Textarea value={editQuestion?.question_text ?? ""} onChange={(e) => setEditQuestion((p) => p ? { ...p, question_text: e.target.value } : null)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <select value={editQuestion?.question_type ?? "short_answer"} onChange={(e) => setEditQuestion((p) => p ? { ...p, question_type: e.target.value } : null)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="multiple_choice">Multiple Choice</option>
                <option value="short_answer">Short Answer</option>
                <option value="true_false">True/False</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Max Points</Label>
              <Input type="number" min={1} value={editQuestion?.max_points ?? 1}
                onChange={(e) => setEditQuestion((p) => p ? { ...p, max_points: parseFloat(e.target.value) || 1 } : null)} />
            </div>
          </div>
          {(editQuestion?.question_type === "multiple_choice" || editQuestion?.question_type === "true_false") && (
            <div className="space-y-2">
              <Label>Options (one per line)</Label>
              <Textarea value={(editQuestion?.options ?? []).join("\n")}
                onChange={(e) => setEditQuestion((p) => p ? { ...p, options: e.target.value.split("\n").filter(Boolean) } : null)}
                rows={4} placeholder="Option A&#10;Option B&#10;Option C&#10;Option D" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Correct Answer</Label>
            <Input value={editQuestion?.correct_answer ?? ""} onChange={(e) => setEditQuestion((p) => p ? { ...p, correct_answer: e.target.value } : null)}
              placeholder="Correct answer text" />
          </div>
          <div className="space-y-2">
            <Label>Explanation</Label>
            <Textarea value={editQuestion?.explanation ?? ""} onChange={(e) => setEditQuestion((p) => p ? { ...p, explanation: e.target.value } : null)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditQuestion(null)} disabled={updateMutation.isPending}>Cancel</Button>
          <Button onClick={() => {
            if (!editQuestion) return;
            const payload: Record<string, unknown> = {};
            if (editQuestion.question_text) payload.question_text = editQuestion.question_text;
            payload.question_type = editQuestion.question_type;
            payload.options = editQuestion.options;
            payload.correct_answer = editQuestion.correct_answer || null;
            payload.explanation = editQuestion.explanation || null;
            payload.max_points = editQuestion.max_points;
            updateMutation.mutate({ questionId: editQuestion.id, payload });
          }} disabled={updateMutation.isPending} className="gap-2">
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const DeleteConfirmDialog = () => (
    <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Question</DialogTitle>
          <DialogDescription>Are you sure you want to delete this question? This cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/20 p-3 text-sm">{deleteTarget?.text}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
          <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending} className="gap-2">
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const AddQuestionPanel = () => (
    <Card className="border-dashed">
      <CardHeader className="pb-3"><CardTitle className="text-sm">New Question</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Question Text <span className="text-destructive">*</span></Label>
          <Textarea value={newQuestion.question_text} onChange={(e) => setNewQuestion((p) => ({ ...p, question_text: e.target.value }))} rows={2} placeholder="Enter the question..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <select value={newQuestion.question_type} onChange={(e) => setNewQuestion((p) => ({ ...p, question_type: e.target.value, options: [], correct_answer: "" }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="short_answer">Short Answer</option>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="true_false">True/False</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Max Points</Label>
            <Input type="number" min={1} value={newQuestion.max_points} onChange={(e) => setNewQuestion((p) => ({ ...p, max_points: parseFloat(e.target.value) || 1 }))} />
          </div>
        </div>
        {(newQuestion.question_type === "multiple_choice" || newQuestion.question_type === "true_false") && (
          <div className="space-y-2">
            <Label>Options (one per line)</Label>
            <Textarea value={newQuestion.options.join("\n")} onChange={(e) => setNewQuestion((p) => ({ ...p, options: e.target.value.split("\n").filter(Boolean) }))}
              rows={4} placeholder="Option A&#10;Option B&#10;etc." />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Correct Answer</Label>
            <Input value={newQuestion.correct_answer} onChange={(e) => setNewQuestion((p) => ({ ...p, correct_answer: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Explanation</Label>
            <Input value={newQuestion.explanation} onChange={(e) => setNewQuestion((p) => ({ ...p, explanation: e.target.value }))} />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newQuestion.question_text.trim()} className="gap-1.5">
            {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Add Question
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setIsAddingNew(false); setNewQuestion({ question_text: "", question_type: "short_answer", options: [], correct_answer: "", explanation: "", max_points: 5 }); }}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <ContentContainer>
      <PageHeader title={hw.title} description={`Homework • ${hw.class_?.name ?? "—"} • ${hw.subject?.name ?? "—"}`}>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/homework")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/homework/${homeworkId}/edit`)}>
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </PageHeader>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge variant={hw.is_published ? "default" : "outline"}>{hw.is_published ? "Published" : "Draft"}</Badge>
        {isOverdue && hw.is_published && <Badge variant="destructive">Overdue</Badge>}
        <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Due {new Date(hw.due_date).toLocaleString()}</span>
        <span className="text-xs text-muted-foreground flex items-center gap-1"><BookText className="h-3 w-3" /> {hw.max_score} pts</span>
        {isScoreOutOfSync && (
          <Button variant="outline" size="sm" className="h-6 gap-1 text-xs"
            onClick={() => syncScoreMutation.mutate(totalQuestionPoints)}
            disabled={syncScoreMutation.isPending}>
            {syncScoreMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Sync ({totalQuestionPoints} pts)
          </Button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Students</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Submitted</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-green-600">{stats.submitted}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Graded</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-600">{stats.graded}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg Score</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{stats.avgScore}</p></CardContent></Card>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><UserRound className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Teacher</p><p className="text-sm font-medium">{hw.teacher?.name ?? "—"}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Building2 className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Class</p><p className="text-sm font-medium">{hw.class_?.name ?? "—"}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><BookOpen className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Subject</p><p className="text-sm font-medium">{hw.subject?.name ?? "—"}</p></div></CardContent></Card>
      </div>

      {hw.description && (
        <Card className="mt-6"><CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{hw.description}</p></CardContent>
        </Card>
      )}

      {/* Tabs: Submissions + Questions */}
      <div className="mt-6">
        <Tabs defaultValue="submissions">
          <TabsList>
            <TabsTrigger value="submissions" className="gap-2">
              <FileText className="h-4 w-4" /> Submissions ({submissions.length})
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-2">
              <BookOpen className="h-4 w-4" /> Questions ({questions.length})
            </TabsTrigger>
          </TabsList>

          {/* ── Submissions Tab ────────────────────────────── */}
          <TabsContent value="submissions" className="mt-4">
            {submissionsQuery.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
            ) : submissions.length === 0 ? (
              <EmptyState variant="no-data" title="No submissions" description="No students have submitted yet." />
            ) : (
              <div className="space-y-2">
                {submissions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {sub.student?.first_name?.[0]}{sub.student?.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{sub.student?.first_name} {sub.student?.last_name}</p>
                        <p className="text-xs text-muted-foreground">{sub.student?.admission_number} — {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "Not submitted"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {sub.is_graded ? (
                        <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> {sub.total_score}/{hw.max_score}</Badge>
                      ) : sub.status === "submitted" ? (
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                          setGradeTarget({ id: sub.id, studentName: `${sub.student?.first_name} ${sub.student?.last_name}`, currentScore: sub.total_score ?? undefined });
                          setGradeScore(sub.total_score?.toString() ?? "");
                        }}><CheckCircle2 className="h-3.5 w-3.5" /> Grade</Button>
                      ) : (
                        <Badge variant="secondary" className="capitalize">{sub.status.replace("_", " ")}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Questions Tab ──────────────────────────────── */}
          <TabsContent value="questions" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">{questions.length} question{questions.length !== 1 ? "s" : ""}</p>
              <div className="flex items-center gap-2">
                {!isReorderMode && (
                  <>
                    {questions.length >= 2 && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                        setIsReorderMode(true);
                        setLocalOrder(questions.map((q: Record<string, unknown>) => q.id as string));
                      }}>
                        <GripVertical className="h-4 w-4" /> Reorder
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setIsAddingNew(true)}>
                      <BookOpen className="h-4 w-4" /> Add Question
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Reorder Mode Banner */}
            {isReorderMode && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-primary" />
                  Drag questions to reorder them
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    setIsReorderMode(false);
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }} disabled={reorderMutation.isPending}>
                    Cancel
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => reorderMutation.mutate(localOrder)}
                    disabled={reorderMutation.isPending}>
                    {reorderMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Order
                  </Button>
                </div>
              </div>
            )}

            {questions.length === 0 && !isAddingNew ? (
              <EmptyState variant="no-data" title="No questions" description="This homework has no questions yet. Add one or use AI generation."
                action={{ label: "Add Question", onClick: () => setIsAddingNew(true) }} />
            ) : (
              <div className="space-y-3">
                {(isReorderMode ? localOrder.map((qid) => questions.find((q: Record<string, unknown>) => q.id === qid)) : questions)
                  .filter(Boolean)
                  .map((q: Record<string, unknown> | undefined, idx: number) => {
                    if (!q) return null;
                    const isDragging = dragIndex === idx;
                    const isDragOver = dragOverIndex === idx;
                    const qid = q.id as string;

                    return (
                      <div
                        key={qid || idx}
                        draggable={isReorderMode}
                        onDragStart={(e) => {
                          if (!isReorderMode) return;
                          e.dataTransfer.effectAllowed = "move";
                          setDragIndex(idx);
                        }}
                        onDragOver={(e) => {
                          if (!isReorderMode || dragIndex === null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverIndex(idx);
                        }}
                        onDragLeave={() => {
                          setDragOverIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!isReorderMode || dragIndex === null || dragIndex === idx) {
                            setDragIndex(null);
                            setDragOverIndex(null);
                            return;
                          }
                          const newOrder = [...localOrder];
                          const [movedItem] = newOrder.splice(dragIndex, 1);
                          newOrder.splice(idx, 0, movedItem);
                          setLocalOrder(newOrder);
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        className={cn(
                          "rounded-lg border p-3 space-y-2 transition-all group",
                          isDragging && "opacity-50 border-primary shadow-md",
                          isDragOver && !isDragging && "border-primary border-2 -translate-y-1",
                          isReorderMode ? "cursor-grab active:cursor-grabbing" : "hover:bg-muted/20",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {isReorderMode && (
                                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              <p className="text-sm font-medium">
                                <span className="text-muted-foreground mr-2">Q{(q.question_number as number) || idx + 1}.</span>
                                {q.question_text as string}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-1 ml-6">
                              <Badge variant="outline" className="text-[10px] px-1.5">
                                {q.question_type === "multiple_choice" ? "MCQ" : q.question_type === "true_false" ? "T/F" : "Short"}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] px-1.5">{q.max_points as number} pts</Badge>
                              {(q as any).correct_answer && <Badge variant="default" className="text-[10px] px-1.5 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Ans: {(q as any).correct_answer}</Badge>}
                            </div>
                          </div>
                          {!isReorderMode && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
                                setEditQuestion({
                                  id: q.id as string,
                                  question_text: q.question_text as string,
                                  question_type: q.question_type as string,
                                  options: (q.options as string[]) ?? null,
                                  correct_answer: (q as any).correct_answer ?? null,
                                  explanation: (q as any).explanation ?? null,
                                  max_points: (q.max_points as number) ?? 1,
                                });
                              }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteTarget({ id: q.id as string, text: q.question_text as string })}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {(q as any).explanation && (
                          <p className="ml-6 text-xs text-muted-foreground"><span className="font-medium">Explanation:</span> {(q as any).explanation}</p>
                        )}
                      </div>
                    );
                  })}

                {/* Add new question inline */}
                {isAddingNew && !isReorderMode && <AddQuestionPanel />}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <QuestionEditDialog />
      <DeleteConfirmDialog />

      {/* Grade Dialog */}
      <Dialog open={!!gradeTarget} onOpenChange={(o) => { if (!o) setGradeTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grade Submission</DialogTitle><DialogDescription>{gradeTarget?.studentName} — Score out of {hw.max_score}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Score <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} max={hw.max_score} step={0.5} value={gradeScore}
                onChange={(e) => setGradeScore(e.target.value)} placeholder={`0 - ${hw.max_score}`} />
            </div>
            <div className="space-y-2">
              <Label>Remarks (optional)</Label>
              <Textarea value={gradeRemarks} onChange={(e) => setGradeRemarks(e.target.value)} placeholder="Feedback..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeTarget(null)} disabled={gradeMutation.isPending}>Cancel</Button>
            <Button onClick={() => gradeTarget && gradeMutation.mutate({ submissionId: gradeTarget.id, score: parseFloat(gradeScore), remarks: gradeRemarks || undefined })}
              disabled={gradeMutation.isPending || !gradeScore} className="gap-2">
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
