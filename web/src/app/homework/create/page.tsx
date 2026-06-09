"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Sparkles,
  RotateCw,
  Check,
  CheckCircle2,
  X,
} from "lucide-react";
import { useUserRole } from "@/hooks/use-auth";
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
import { homeworkService } from "@/services/homework.service";
import { classService } from "@/services/class.service";
import { subjectService } from "@/services/subject.service";
import { academicService } from "@/services/academic.service";
import { assignmentService } from "@/services/assignment.service";
import { cn } from "@/lib/utils";
import type { CreateHomeworkRequest } from "@/types/homework";
import type { AIQuestion } from "@/types/dashboard";

export default function CreateHomeworkPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useUserRole();

  // Only teachers can create homework
  if (!role.isTeacher) {
    router.replace("/homework");
    return null;
  }
  const { toast } = useToast();

  const [form, setForm] = useState({
    class_id: "",
    subject_id: "",
    title: "",
    description: "",
    due_date: "",
    max_score: 100,
    is_published: false,
  });

  // ── AI Generation State ────────────────────────────────────
  const [aiState, setAiState] = useState<{
    chapterTopic: string;
    questionCount: number;
    questionTypes: string[];
  }>({
    chapterTopic: "",
    questionCount: 5,
    questionTypes: ["multiple_choice", "short_answer"],
  });

  const [aiResult, setAiResult] = useState<{
    title: string;
    questions: AIQuestion[];
  } | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAcceptedDialog, setShowAcceptedDialog] = useState(false);

  const toggleQuestionType = (type: string) => {
    setAiState((prev) => ({
      ...prev,
      questionTypes: prev.questionTypes.includes(type)
        ? prev.questionTypes.filter((t) => t !== type)
        : [...prev.questionTypes, type],
    }));
  };

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: queryKeys.classes.list({ limit: 200 }),
    queryFn: () => classService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
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

  // Fetch assignments for selected class to filter subjects
  const { data: assignmentsData } = useQuery({
    queryKey: queryKeys.assignments.list({ class_id: form.class_id }),
    queryFn: () => assignmentService.list({ class_id: form.class_id }),
    enabled: !!form.class_id,
    staleTime: 30_000,
  });

  // Filter subjects by selected class's assigned subjects
  const filteredSubjects = useMemo(() => {
    if (!form.class_id || !assignmentsData?.assignments) return subjects;
    const subjectIdsInClass = new Set(assignmentsData.assignments.map((a) => a.subject_id));
    if (subjectIdsInClass.size === 0) return subjects;
    return subjects.filter((s) => subjectIdsInClass.has(s.id));
  }, [subjects, assignmentsData, form.class_id]);

  // Reset subject and AI state when class changes
  const handleClassChange = (v: string) => {
    set("class_id", v);
    set("subject_id", "");
    setAiResult(null);
    setAiError(null);
  };

  const createMutation = useMutation({
    mutationFn: async (payload: CreateHomeworkRequest) => {
      // Step 1: Create the homework
      const created = await homeworkService.create(payload);

      // Step 2: If AI-generated questions exist, save them to the homework
      if (aiResult && aiResult.questions.length > 0) {
        await homeworkService.saveQuestions(created.id, aiResult.questions);
      }

      return created;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.homework.all });
      const qCount = aiResult?.questions.length ?? 0;
      toast({
        title: "Homework created",
        description: qCount > 0
          ? `"${data.title}" created with ${qCount} AI-generated questions.`
          : `"${data.title}" has been created.`,
      });
      router.push(`/homework/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    },
  });

  // ── AI Generation Handler ───────────────────────────────────
  const handleAiGenerate = async () => {
    if (!form.class_id || !form.subject_id) {
      toast({ title: "Select class and subject", description: "Please select a class and subject before generating.", variant: "destructive" });
      return;
    }
    if (!aiState.chapterTopic.trim()) {
      toast({ title: "Enter a topic", description: "Please enter a chapter or topic name.", variant: "destructive" });
      return;
    }
    if (aiState.questionTypes.length === 0) {
      toast({ title: "Select question types", description: "Please select at least one question type.", variant: "destructive" });
      return;
    }

    const selectedClass = classes.find((c) => c.id === form.class_id);
    const selectedSubject = filteredSubjects.find((s) => s.id === form.subject_id);
    if (!selectedClass || !selectedSubject) return;

    setIsAiGenerating(true);
    setAiError(null);
    setAiResult(null);

    try {
      const result = await homeworkService.generateAI({
        subject_name: selectedSubject.name,
        class_name: `${selectedClass.name}${selectedClass.section ? ` ${selectedClass.section}` : ""}`,
        chapter_topic: aiState.chapterTopic.trim(),
        question_count: aiState.questionCount,
        question_types: aiState.questionTypes,
      });
      setAiResult(result);
      toast({ title: "Questions generated", description: `AI created ${result.questions.length} questions.` });
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
    // Auto-calculate max_score as sum of all question max_points
    const suggestedMaxScore = aiResult.questions.reduce((sum, q) => sum + q.max_points, 0);
    if (suggestedMaxScore > 0) {
      set("max_score", suggestedMaxScore);
    }
    setShowAcceptedDialog(true);
  };

  const handleRejectAiResult = () => {
    setAiResult(null);
    setAiError(null);
    toast({ title: "Dismissed", description: "You can generate new questions anytime." });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.class_id || !form.subject_id || !form.title || !form.due_date) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      class_id: form.class_id,
      subject_id: form.subject_id,
      academic_term_id: currentTermId,
      title: form.title,
      due_date: new Date(form.due_date).toISOString(),
      description: form.description || undefined,
      max_score: form.max_score,
      is_published: form.is_published,
    });
  };

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  if (classesLoading || subjectsLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <Skeleton className="h-8 w-48" />
          <div className="mt-6 space-y-4">
            <Skeleton className="h-12 w-full" />
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
        <PageHeader title="Create Homework" description="Create a new homework assignment.">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/homework")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assignment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class <span className="text-destructive">*</span></Label>
                  <Select value={form.class_id} onValueChange={(v) => { if (v) handleClassChange(v); }}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
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
                <Input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Chapter 5: Algebra Review"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Instructions, reading list, or additional notes..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Due Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="datetime-local"
                    value={form.due_date}
                    onChange={(e) => set("due_date", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Score</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.max_score}
                    onChange={(e) => set("max_score", parseInt(e.target.value) || 100)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Switch
                  checked={form.is_published}
                  onCheckedChange={(v) => set("is_published", v)}
                  id="published"
                />
                <Label htmlFor="published" className="cursor-pointer">
                  Publish immediately (visible to students)
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* ── AI Generation Panel ──────────────────────────────── */}
          {form.class_id && form.subject_id && (
            <Card className="border-primary/20 bg-primary/[0.02]">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">AI Homework Generation</CardTitle>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">BETA</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Chapter/Topic */}
                <div className="space-y-2">
                  <Label>Chapter / Topic</Label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      value={aiState.chapterTopic}
                      onChange={(e) => setAiState((p) => ({ ...p, chapterTopic: e.target.value }))}
                      placeholder="e.g. Quadratic Equations, Photosynthesis, World War II..."
                      className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Question Count Slider */}
                  <div className="space-y-2">
                    <Label>Number of Questions: <span className="font-bold text-primary">{aiState.questionCount}</span></Label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">1</span>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        value={aiState.questionCount}
                        onChange={(e) => setAiState((p) => ({ ...p, questionCount: parseInt(e.target.value) }))}
                        className="flex-1 h-2 cursor-pointer accent-primary"
                      />
                      <span className="text-xs text-muted-foreground">20</span>
                    </div>
                  </div>

                  {/* Question Types */}
                  <div className="space-y-2">
                    <Label>Question Types</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "multiple_choice", label: "MCQ" },
                        { value: "short_answer", label: "Short Answer" },
                        { value: "true_false", label: "True/False" },
                      ].map((qt) => (
                        <button
                          key={qt.value}
                          type="button"
                          onClick={() => toggleQuestionType(qt.value)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            aiState.questionTypes.includes(qt.value)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-muted-foreground"
                          )}
                        >
                          {aiState.questionTypes.includes(qt.value) && <Check className="h-3 w-3" />}
                          {qt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={isAiGenerating || !aiState.chapterTopic.trim() || aiState.questionTypes.length === 0}
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

                {/* AI Error */}
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
                           q.question_type === "true_false" ? "T/F" : "Short"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5">{q.max_points} pts</Badge>
                      </div>
                    </div>
                    {q.options && q.options.length > 0 && (
                      <div className="ml-4 space-y-1">
                        {q.options.map((opt, oi) => (
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

          {createMutation.isError && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              <p className="text-destructive">{createMutation.error?.message}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {createMutation.isPending ? "Creating..." : "Create Homework"}
            </Button>
            <Button variant="outline" type="button" onClick={() => router.push("/homework")}>
              Cancel
            </Button>
          </div>
        </form>

        {/* Accepted Dialog */}
        <Dialog open={showAcceptedDialog} onOpenChange={setShowAcceptedDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>AI Content Accepted</DialogTitle>
              <DialogDescription>
                The title has been pre-filled. You can edit it before creating the homework.
                The generated questions will be added to the homework for student viewing.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                AI generated <strong>{aiResult?.questions.length ?? 0} questions</strong> for
                "<strong>{aiResult?.title ?? ""}</strong>".
                Review the details, make any changes, then create the homework.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowAcceptedDialog(false)}>
                Got it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
