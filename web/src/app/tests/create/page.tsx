"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  FileBarChart,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useUserRole } from "@/hooks/use-auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { testService } from "@/services/test.service";
import { classService } from "@/services/class.service";
import { subjectService } from "@/services/subject.service";
import { academicService } from "@/services/academic.service";
import type { CreateTestRequest } from "@/types/test";

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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class <span className="text-destructive">*</span></Label>
                  <Select value={form.class_id} onValueChange={(v) => set("class_id", v)}>
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
                      {subjects.map((s) => (
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

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {createMutation.isPending ? "Creating..." : "Create Test"}
            </Button>
            <Button variant="outline" type="button" onClick={() => router.push("/tests")}>Cancel</Button>
          </div>
        </form>
      </ContentContainer>
    </AdminLayout>
  );
}
