"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  BookOpen,
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
import { homeworkService } from "@/services/homework.service";
import { classService } from "@/services/class.service";
import { subjectService } from "@/services/subject.service";
import { academicService } from "@/services/academic.service";
import type { CreateHomeworkRequest } from "@/types/homework";

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

  // Filter subjects by selected class's assigned subjects
  const filteredSubjects = subjects;

  const createMutation = useMutation({
    mutationFn: (payload: CreateHomeworkRequest) => homeworkService.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.homework.all });
      toast({ title: "Homework created", description: `"${data.title}" has been created.` });
      router.push(`/homework/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    },
  });

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
      </ContentContainer>
    </AdminLayout>
  );
}
