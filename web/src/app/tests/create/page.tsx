"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  FileBarChart,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Sparkles,
  RotateCw,
  Check,
  CheckCircle2,
  X,
  BookOpen,
  Info,
} from "lucide-react";
import { useUserRole } from "@/hooks/use-auth";
import { useAuthStore } from "@/hooks/use-auth-store";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { testService } from "@/services/test.service";
import { classService } from "@/services/class.service";
import { subjectService } from "@/services/subject.service";
import { academicService } from "@/services/academic.service";
import { assignmentService } from "@/services/assignment.service";
import { timetableService } from "@/services/timetable.service";
import { cn } from "@/lib/utils";
import type { CreateTestRequest } from "@/types/test";
import type { AITestQuestion } from "@/types/test";
import type { TimetableEntry } from "@/types/timetable";

const TEST_TYPES = [
  { value: "quiz", label: "Quiz" },
  { value: "class_test", label: "Class Test" },
  { value: "midterm", label: "Midterm" },
  { value: "final", label: "Final Exam" },
  { value: "mock", label: "Mock Exam" },
];

export default function CreateTestPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useUserRole();

  // Only teachers can create tests
  if (!role.isTeacher) {
    router.replace("/tests");
    return null;
  }
  const { toast } = useToast();

  const [form, setForm] = useState({
    class_id: "",
    subject_id: "",
    title: "",
    description: "",
    test_type: "class_test",
    total_marks: 100,
    duration_minutes: 60,
    passing_percentage: 40,
    scheduled_at: "",
    is_published: false,
  });

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: queryKeys.classes.list({ limit: 200 }),
    queryFn: () => classService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: subjectsData } = useQuery({
    queryKey: queryKeys.subjects.list({ limit: 200 }),
    queryFn: () => subjectService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: termsData } = useQuery({
    queryKey: queryKeys.academicTerms.list({ limit: 10 }),
    queryFn: () => academicService.listTerms(),
    staleTime: 60_000,
  });

  const classes = classesData?.classes ?? [];
  const subjects = subjectsData?.subjects ?? [];
  const terms = termsData?.academic_terms ?? [];
  const currentTermId = terms.find((t) => t.is_current)?.id ?? terms[0]?.id ?? "";

  // ── Teacher class filtering (BUG-004 fix) ────────────────────
  const user = useAuthStore((s) => s.user);
  const { data: timetableData } = useQuery({
    queryKey: queryKeys.timetable.myTeacher,
    queryFn: () => timetableService.getMyTimetable(),
    enabled: role.isTeacher,
    staleTime: 60_000,
  });

  const assignedClassIds = useMemo(() => {
    if (!role.isTeacher || !timetableData?.entries) return null;
    return new Set(timetableData.entries.map((e: TimetableEntry) => e.class_.id));
  }, [role.isTeacher, timetableData]);

  const visibleClasses = useMemo(() => {
    if (!assignedClassIds) return classes;
    return classes.filter((c) => assignedClassIds.has(c.id));
  }, [classes, assignedClassIds]);

  const hasTimetable = role.isTeacher && timetableData?.entries && timetableData.entries.length > 0;

  // ── Subject filtering by class assignments (BUG-003 fix) ─────
  const { data: assignmentsData } = useQuery({
    queryKey: queryKeys.assignments.list({ class_id: form.class_id }),
    queryFn: () => assignmentService.list({ class_id: form.class_id }),
    enabled: !!form.class_id,
    staleTime: 30_000,
  });

  const filteredSubjects = useMemo(() => {
    if (!form.class_id || !assignmentsData?.assignments) return subjects;
    const subjectIdsInClass = new Set(assignmentsData.assignments.map((a) => a.subject_id));
    if (subjectIdsInClass.size === 0) return subjects;
    return subjects.filter((s) => subjectIdsInClass.has(s.id));
  }, [subjects, assignmentsData, form.class_id]);

  const handleClassChange = (v: string) => {
    set("class_id", v);
    set("subject_id", "");
    setAiResult(null);
    setAiError(null);
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateTestRequest) => testService.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tests.all });
      toast({ title: "Test created", description: `"${data.title}" has been created.` });
      router.push(`/tests/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.class_id || !form.subject_id || !form.title) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      class_id: form.class_id,
      subject_id: form.subject_id,
      academic_term_id: currentTermId,
      title: form.title,
      description: form.description || undefined,
      test_type: form.test_type,
      total_marks: form.total_marks,
      duration_minutes: form.duration_minutes,
      passing_percentage: form.passing_percentage,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : undefined,
      is_published: form.is_published,
    });
  };

  // ── AI Generation State ────────────────────────────────────
  const [aiState, setAiState] = useState({
    chapterTopic: "",
    questionCount: 10,
    difficulty: "medium",
  });
  const [aiResult, setAiResult] = useState<{
    title: string;
    questions: AITestQuestion[];
  } | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAcceptedDialog, setShowAcceptedDialog] = useState(false);

  const handleAiGenerate = async () => {
    if (!form.class_id || !form.subject_id) {
      toast({ title: "Select class and subject", description: "Please select a class and subject first.", variant: "destructive" });
      return;
    }
    if (!aiState.chapterTopic.trim()) {
      toast({ title: "Enter a topic", description: "Please enter a chapter or topic name.", variant: "destructive" });
      return;
    }

    const selectedClass = classes.find((c) => c.id === form.class_id);
    const selectedSubject = subjects.find((s) => s.id === form.subject_id);
    if (!selectedClass || !selectedSubject) return;

    setIsAiGenerating(true);
    setAiError(null);
    setAiResult(null);

    try {
      const result = await testService.generateAI({
        subject_name: selectedSubject.name,
        class_name: `${selectedClass.name}${selectedClass.section ? ` ${selectedClass.section}` : ""}`,
        chapter_topic: aiState.chapterTopic.trim(),
        test_type: form.test_type,
        question_count: aiState.questionCount,
        total_marks: form.total_marks,
        duration_minutes: form.duration_minutes,
        difficulty: aiState.difficulty,
      });
      setAiResult(result);
      toast({ title: "Test generated", description: `AI created ${result.questions.length} questions.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI generation failed. Please try again.";
      setAiError(msg);
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleAcceptAiResult = () => {
    if (!aiResult) return;
    set("title", aiResult.title);
    setShowAcceptedDialog(true);
  };

  const handleRejectAiResult = () => {
    setAiResult(null);
    setAiError(null);
    toast({ title: "Dismissed", description: "You can generate new questions anytime." });
  };

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  if (classesLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <Skeleton className="h-8 w-48" />
          <div className="mt-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader title="Create Test" description="Create a new test or exam.">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/tests")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* No timetable banner */}
              {role.isTeacher && assignedClassIds && !hasTimetable && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <Info className="h-4 w-4 shrink-0" />
                  <p>No timetable found. Showing all classes. Create a timetable for filtered class selection.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class <span className="text-destructive">*</span></Label>
                  <Select value={form.class_id} onValueChange={(v) => { if (v) handleClassChange(v); }}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {visibleClasses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.section ? ` - ${c.section}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject <span className="text-destructive">*</span></Label>
                  <Select value={form.subject_id} onValueChange={(v) => set("subject_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {filteredSubjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Chapter 5 Test" required />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Instructions or notes..." rows={3} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Test Type</Label>
                  <Select value={form.test_type} onValueChange={(v) => set("test_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEST_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Scheduled At</Label>
                  <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => set("scheduled_at", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Total Marks</Label>
                  <Input type="number" min={1} value={form.total_marks} onChange={(e) => set("total_marks", parseInt(e.target.value) || 100)} />
                </div>
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input type="number" min={1} value={form.duration_minutes} onChange={(e) => set("duration_minutes", parseInt(e.target.value) || 60)} />
                </div>
                <div className="space-y-2">
                  <Label>Pass %</Label>
                  <Input type="number" min={0} max={100} value={form.passing_percentage} onChange={(e) => set("passing_percentage", parseInt(e.target.value) || 40)} />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Switch checked={form.is_published} onCheckedChange={(v) => set("is_published", v)} id="published" />
                <Label htmlFor="published" className="cursor-pointer">Publish immediately (visible to students)</Label>
              </div>
            </CardContent>
          </Card>

          {/* ── AI Generation Panel ──────────────────────────────── */}
          {form.class_id && form.subject_id && (
            <Card className="border-primary/20 bg-primary/[0.02]">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">AI Test Generation</CardTitle>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">BETA</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Chapter / Topic</Label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      value={aiState.chapterTopic}
                      onChange={(e) => setAiState((p) => ({ ...p, chapterTopic: e.target.value }))}
                      placeholder="e.g. Quadratic Equations, Photosynthesis, The Mughal Empire..."
                      className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Questions: <span className="font-bold text-primary">{aiState.questionCount}</span></Label>
                    <input
                      type="range"
                      min={3}
                      max={30}
                      value={aiState.questionCount}
                      onChange={(e) => setAiState((p) => ({ ...p, questionCount: parseInt(e.target.value) }))}
                      className="w-full h-2 cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>3</span>
                      <span>30</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select value={aiState.difficulty} onValueChange={(v) => { if (v) setAiState((p) => ({ ...p, difficulty: v })); }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Test Type</Label>
                    <Select value={form.test_type} onValueChange={(v) => set("test_type", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEST_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={isAiGenerating || !aiState.chapterTopic.trim()}
                    className="gap-2"
                  >
                    {isAiGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isAiGenerating ? "Generating..." : "Generate with AI"}
                  </Button>
                  {aiResult && (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleRejectAiResult}>
                      <X className="h-3.5 w-3.5" /> Dismiss
                    </Button>
                  )}
                </div>

                {aiError && (
                  <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                    <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                    <p className="flex-1 text-destructive">{aiError}</p>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAiGenerate} disabled={isAiGenerating}>
                      <RotateCw className="h-3.5 w-3.5" /> Retry
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── AI Question Preview ──────────────────────────────── */}
          {aiResult && aiResult.questions.length > 0 && (
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <CardTitle className="text-base">Generated Questions Preview</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{aiResult.questions.length} questions</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" className="gap-1.5" onClick={handleAcceptAiResult}>
                    <Check className="h-3.5 w-3.5" /> Accept & Fill Title
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleRejectAiResult}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-sm font-medium">{aiResult.title}</p>
                </div>
                <Separator />
                {aiResult.questions.map((q, idx) => (
                  <div key={idx} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">
                        <span className="text-muted-foreground mr-2">Q{idx + 1}.</span>
                        {q.question_text}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-[10px] px-1.5">
                          {q.question_type === "multiple_choice" ? "MCQ" :
                           q.question_type === "short_answer" ? "Short" :
                           q.question_type === "true_false" ? "T/F" : "Essay"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5">{q.max_points} pts</Badge>
                      </div>
                    </div>
                    {q.options && q.options.length > 0 && (
                      <div className="ml-4 space-y-1">
                        {q.options.map((opt: string, oi: number) => (
                          <div key={oi} className={cn(
                            "flex items-center gap-2 rounded-md px-2.5 py-1 text-xs",
                            opt === q.correct_answer
                              ? "bg-green-50 text-green-700 font-medium"
                              : "text-muted-foreground"
                          )}>
                            {opt === q.correct_answer ? (
                              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                            ) : (
                              <div className="h-3 w-3 shrink-0" />
                            )}
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.explanation && (
                      <div className="ml-4 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
                        <span className="font-medium">Explanation: </span>{q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {createMutation.isPending ? "Creating..." : "Create Test"}
            </Button>
            <Button variant="outline" type="button" onClick={() => router.push("/tests")}>Cancel</Button>
          </div>
        </form>

        {/* Accepted Dialog */}
        <Dialog open={showAcceptedDialog} onOpenChange={setShowAcceptedDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>AI Content Accepted</DialogTitle>
              <DialogDescription>
                The title has been pre-filled. You can edit it before creating the test.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setShowAcceptedDialog(false)}>Got it</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
