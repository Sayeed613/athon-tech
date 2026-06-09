"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  FileBarChart,
  ArrowLeft,
  Pencil,
  RefreshCw,
  AlertCircle,
  Calendar,
  Clock,
  UserRound,
  Building2,
  BookOpen,
  Trophy,
  Eye,
  Loader2,
  Check,
  CheckCircle2,
  Send,
  HelpCircle,
  ListChecks,
  Timer,
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
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { testService } from "@/services/test.service";
import { cn } from "@/lib/utils";

// ── Student Test View ─────────────────────────────────────────

function StudentTestView({ testId }: { testId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewState, setViewState] = useState<"detail" | "taking" | "submitted">("detail");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const { data: test, isLoading, isError } = useQuery({
    queryKey: queryKeys.tests.detail(testId),
    queryFn: () => testService.get(testId),
    enabled: !!testId,
  });

  // Check for existing submission
  const { data: myAttempt } = useQuery({
    queryKey: [...queryKeys.tests.detail(testId), "my-attempt"],
    queryFn: async () => {
      const results = await testService.getResults(testId);
      const attempts = results.attempts ?? [];
      return attempts[0] ?? null;
    },
    enabled: !!testId,
  });

  const isAlreadySubmitted = myAttempt?.status === "submitted" || myAttempt?.status === "graded";

  // Start test mutation
  const startMutation = useMutation({
    mutationFn: () => testService.startTest(testId),
    onSuccess: (attempt) => {
      setStartError(null);
      setStartedAt(attempt.started_at);
      setViewState("taking");
    },
    onError: (err: Error) => {
      setStartError(err.message);
      toast({ title: "Cannot start test", description: err.message, variant: "destructive" });
    },
  });

  // Submit test mutation
  const submitMutation = useMutation({
    mutationFn: () => testService.submitTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tests.detail(testId) });
      toast({ title: "Test submitted!", description: "Your test has been submitted successfully." });
      setViewState("submitted");
      setShowConfirm(false);
    },
    onError: (err: Error) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  // Timer effect — synced with server started_at, auto-submits on expire
  const autoSubmitRef = useRef(false);

  useEffect(() => {
    if (viewState !== "taking" || !test?.duration_minutes || isAlreadySubmitted || !startedAt) return;

    const startedMs = new Date(startedAt).getTime();
    const durationMs = test.duration_minutes * 60 * 1000;
    const nowMs = Date.now();
    const elapsedMs = nowMs - startedMs;
    const initialRemaining = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000));

    setTimeRemaining(initialRemaining);

    if (initialRemaining <= 0) {
      // Already expired — auto-submit immediately
      if (!autoSubmitRef.current) {
        autoSubmitRef.current = true;
        submitMutation.mutate();
      }
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          // Auto-submit when time expires
          if (!autoSubmitRef.current) {
            autoSubmitRef.current = true;
            submitMutation.mutate();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [viewState, test?.duration_minutes, isAlreadySubmitted, startedAt]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // Fetch real questions from backend (only when taking the test)
  const { data: realQuestions, isLoading: questionsLoading } = useQuery({
    queryKey: [...queryKeys.tests.detail(testId), "questions"],
    queryFn: () => testService.getQuestions(testId),
    enabled: viewState === "taking" && !!testId,
    retry: 1,
  });

  const questions = realQuestions ?? [];

  if (isLoading) {
    return (
      <ContentContainer>
        <Skeleton className="h-8 w-64" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </ContentContainer>
    );
  }

  if (isError || !test) {
    return (
      <ContentContainer>
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="flex-1 text-destructive">Test not found.</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/tests")}>Back to Tests</Button>
        </div>
      </ContentContainer>
    );
  }

  const isScheduled = test.scheduled_at && new Date(test.scheduled_at) > new Date();
  const isPast = test.scheduled_at && new Date(test.scheduled_at) < new Date();

  // Submitted view
  if (isAlreadySubmitted || viewState === "submitted") {
    return (
      <ContentContainer>
        <PageHeader title={test.title} description={`${test.subject?.name ?? "—"}`}>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/tests")}>
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
            <h2 className="text-xl font-semibold">Test Submitted</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {myAttempt?.submitted_at
                ? `Submitted on ${new Date(myAttempt.submitted_at).toLocaleString()}`
                : "Your test has been submitted."}
            </p>
            {myAttempt?.is_graded && myAttempt?.total_score != null && (
              <div className="mt-6">
                <p className="text-3xl font-bold text-primary">
                  {myAttempt.total_score} / {test.total_marks}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Your score</p>
              </div>
            )}
            <Button variant="outline" className="mt-8" onClick={() => router.push("/tests")}>
              Back to Tests
            </Button>
          </CardContent>
        </Card>
      </ContentContainer>
    );
  }

  // Taking the test
  if (viewState === "taking") {
    const unansweredCount = questions.filter((q) => !answers[q.id]).length;

    return (
      <ContentContainer>
        {/* Timer Bar */}
        {timeRemaining !== null && (
          <div className={cn(
            "sticky top-0 z-10 -mx-4 -mt-4 mb-4 rounded-t-lg border-b px-4 py-2 flex items-center justify-between",
            timeRemaining < 300 ? "bg-red-50 border-red-200" : "bg-muted/50"
          )}>
            <div className="flex items-center gap-2">
              <Timer className={cn("h-4 w-4", timeRemaining < 300 ? "text-red-500" : "text-muted-foreground")} />
              <span className={cn("font-medium text-sm", timeRemaining < 300 ? "text-red-600" : "")}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ListChecks className="h-4 w-4" />
              <span>{questions.length} questions</span>
              {unansweredCount > 0 && (
                <span className="text-amber-600 font-medium">{unansweredCount} unanswered</span>
              )}
            </div>
          </div>
        )}

        {questionsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-4">
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
                        {q.max_points} pts
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {q.question_type === "multiple_choice" && q.options ? (
                      <RadioGroup
                        value={answers[q.id] ?? ""}
                        onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                      >
                        {q.options.map((opt, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                            <RadioGroupItem value={opt} id={`tq-${q.id}-${i}`} />
                            <Label htmlFor={`tq-${q.id}-${i}`} className="flex-1 cursor-pointer text-sm">{opt}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      <Textarea
                        placeholder="Type your answer..."
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        rows={3}
                        className="resize-y"
                      />
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Submit Button */}
              <div className="sticky bottom-4 flex items-center justify-between rounded-lg border bg-background p-4 shadow-lg">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{questions.length - unansweredCount}</span>
                  {" "}of {questions.length} answered
                </p>
                <Button onClick={() => setShowConfirm(true)} disabled={submitMutation.isPending} className="gap-2">
                  {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitMutation.isPending ? "Submitting..." : "Submit Test"}
                </Button>
              </div>
            </div>

            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit Test</DialogTitle>
                  <DialogDescription>
                    You are about to submit "{test.title}". 
                    {unansweredCount > 0 && (
                      <span className="block mt-1 text-amber-600">
                        {unansweredCount} question{unansweredCount > 1 ? "s" : ""} unanswered.
                      </span>
                    )}
                    <span className="block mt-1">You cannot change your answers after submission.</span>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
                  <Button onClick={() => {
                    submitMutation.mutate();
                  }} className="gap-2">
                    <Check className="h-4 w-4" /> Confirm Submit
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </ContentContainer>
    );
  }

  // Detail view (default)
  return (
    <ContentContainer>
      <PageHeader title={test.title} description={`${test.subject?.name ?? "—"}`}>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/tests")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </PageHeader>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge variant={test.is_published ? "default" : "outline"}>
          {test.is_published ? "Published" : "Draft"}
        </Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Trophy className="h-3 w-3" /> {test.total_marks} marks
        </span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> {test.duration_minutes} min
        </span>
        {test.scheduled_at && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {new Date(test.scheduled_at).toLocaleString()}
          </span>
        )}
      </div>

      {test.description && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{test.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Start / Status */}
      <div className="mt-8 text-center">
        {!test.is_published ? (
          <Card>
            <CardContent className="p-8">
              <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Test Not Available</h3>
              <p className="text-sm text-muted-foreground mt-1">This test has not been published yet.</p>
            </CardContent>
          </Card>
        ) : isScheduled ? (
          <Card>
            <CardContent className="p-8">
              <Timer className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Test Scheduled</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This test will be available on {new Date(test.scheduled_at!).toLocaleString()}.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="inline-flex flex-col items-center gap-4 rounded-xl border bg-muted/20 p-8">
            <HelpCircle className="h-12 w-12 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Ready to start?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {test.total_marks} marks · {test.duration_minutes} minutes{test.passing_percentage ? ` · ${test.passing_percentage}% to pass` : ""}
              </p>
            </div>
            <Button size="lg" className="gap-2 min-w-[200px]" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
              {startMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <BookOpen className="h-5 w-5" />}
              {startMutation.isPending ? "Starting..." : "Start Test"}
            </Button>
            {startError && (
              <p className="text-xs text-red-500 max-w-sm">{startError}</p>
            )}
          </div>
        )}
      </div>
    </ContentContainer>
  );
}

// ── Teacher Test View ─────────────────────────────────────────

function TeacherTestView({ testId }: { testId: string }) {
  const router = useRouter();

  const { data: test, isLoading, isError } = useQuery({
    queryKey: queryKeys.tests.detail(testId),
    queryFn: () => testService.get(testId),
    enabled: !!testId,
  });

  const resultsQuery = useQuery({
    queryKey: queryKeys.tests.results(testId),
    queryFn: () => testService.getResults(testId),
    enabled: !!testId,
  });

  const attempts = resultsQuery.data?.attempts ?? [];

  const stats = useMemo(() => {
    const scores = attempts.filter((a) => a.total_score != null).map((a) => a.total_score!);
    const graded = attempts.filter((a) => a.is_graded).length;
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const highest = scores.length > 0 ? Math.max(...scores) : 0;
    const lowest = scores.length > 0 ? Math.min(...scores) : 0;
    const passCount = test ? scores.filter((s) => s >= (test.total_marks * test.passing_percentage / 100)).length : 0;
    const passRate = scores.length > 0 ? Math.round((passCount / scores.length) * 100) : 0;
    return { total: attempts.length, graded, avg: Math.round(avg * 100) / 100, highest, lowest, passRate };
  }, [attempts, test]);

  if (isLoading) {
    return (
      <ContentContainer>
        <Skeleton className="h-8 w-64" />
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </ContentContainer>
    );
  }

  if (isError || !test) {
    return (
      <ContentContainer>
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="flex-1 text-destructive">Test not found.</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/tests")}>Back to Tests</Button>
        </div>
      </ContentContainer>
    );
  }

  const statusLabel = !test.is_published ? "Draft" : test.is_results_published ? "Results Published" : "Published";
  const statusVariant = !test.is_published ? "outline" : test.is_results_published ? "default" : "secondary" as const;

  return (
    <ContentContainer>
      <PageHeader
        title={test.title}
        description={`${test.test_type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} • ${test.class_?.name ?? "—"} • ${test.subject?.name ?? "—"}`}
      >
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/tests")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/tests/${testId}/edit`)}>
          <Pencil className="h-4 w-4" /> Edit
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/tests/${testId}/results`)}>
          <Trophy className="h-4 w-4" /> Results
        </Button>
      </PageHeader>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge variant={statusVariant}>{statusLabel}</Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Trophy className="h-3 w-3" /> {test.total_marks} marks
        </span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> {test.duration_minutes} min
        </span>
        {test.scheduled_at && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {new Date(test.scheduled_at).toLocaleString()}
          </span>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Attempts</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{stats.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Average</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-blue-600">{stats.avg}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Highest</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-600">{stats.highest}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pass Rate</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{stats.passRate}%</p></CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <UserRound className="h-5 w-5 text-muted-foreground" />
          <div><p className="text-xs text-muted-foreground">Teacher</p><p className="text-sm font-medium">{test.teacher?.name ?? "—"}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <div><p className="text-xs text-muted-foreground">Class</p><p className="text-sm font-medium">{test.class_?.name ?? "—"}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <div><p className="text-xs text-muted-foreground">Subject</p><p className="text-sm font-medium">{test.subject?.name ?? "—"}</p></div>
        </CardContent></Card>
      </div>

      {test.description && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{test.description}</p></CardContent>
        </Card>
      )}

      <div className="mt-6">
        <Tabs defaultValue="attempts">
          <TabsList>
            <TabsTrigger value="attempts" className="gap-2">
              <Eye className="h-4 w-4" /> Attempts ({attempts.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="attempts" className="mt-4">
            {resultsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : attempts.length === 0 ? (
              <EmptyState variant="no-data" title="No attempts" description="No students have attempted this test yet." />
            ) : (
              <div className="space-y-2">
                {attempts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {a.student?.first_name?.[0]}{a.student?.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{a.student?.first_name} {a.student?.last_name}</p>
                        <p className="text-xs text-muted-foreground">{a.student?.admission_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {a.is_graded ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {a.total_score}/{test.total_marks}
                        </Badge>
                      ) : a.status === "submitted" ? (
                        <Badge variant="secondary">Grading Needed</Badge>
                      ) : (
                        <Badge variant="outline" className="capitalize">{a.status.replace("_", " ")}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ContentContainer>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function TestDetailPage() {
  const params = useParams();
  const role = useUserRole();
  const testId = params.id as string;

  if (role.isStudent) {
    return (
      <AdminLayout>
        <StudentTestView testId={testId} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <TeacherTestView testId={testId} />
    </AdminLayout>
  );
}
