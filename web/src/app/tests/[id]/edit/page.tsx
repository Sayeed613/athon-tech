"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
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
import type { UpdateTestRequest } from "@/types/test";

const TEST_TYPES = [
  { value: "quiz", label: "Quiz" },
  { value: "class_test", label: "Class Test" },
  { value: "midterm", label: "Midterm" },
  { value: "final", label: "Final Exam" },
  { value: "mock", label: "Mock Exam" },
];

export default function EditTestPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useUserRole();

  // Only teachers can edit tests
  if (!role.isTeacher) {
    router.replace("/tests");
    return null;
  }
  const { toast } = useToast();
  const testId = params.id as string;

  const [form, setForm] = useState({
    title: "",
    description: "",
    test_type: "class_test",
    total_marks: 100,
    duration_minutes: 60,
    passing_percentage: 40,
    scheduled_at: "",
    is_published: false,
  });
  const [initialized, setInitialized] = useState(false);

  const { data: test, isLoading } = useQuery({
    queryKey: queryKeys.tests.detail(testId),
    queryFn: () => testService.get(testId),
    enabled: !!testId,
  });

  useEffect(() => {
    if (test && !initialized) {
      setForm({
        title: test.title,
        description: test.description ?? "",
        test_type: test.test_type,
        total_marks: test.total_marks,
        duration_minutes: test.duration_minutes,
        passing_percentage: test.passing_percentage,
        scheduled_at: test.scheduled_at ? new Date(test.scheduled_at).toISOString().slice(0, 16) : "",
        is_published: test.is_published,
      });
      setInitialized(true);
    }
  }, [test, initialized]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateTestRequest) => testService.update(testId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tests.detail(testId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tests.all });
      toast({ title: "Updated", description: "Test updated successfully." });
      router.push(`/tests/${testId}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) {
      toast({ title: "Missing fields", description: "Title is required.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
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

  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <Skeleton className="h-8 w-48" />
          <div className="mt-6 space-y-4"><Skeleton className="h-12 w-full" /></div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader title="Edit Test" description={test?.title ?? ""}>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/tests/${testId}`)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
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
                <Label htmlFor="published" className="cursor-pointer">Published</Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" type="button" onClick={() => router.push(`/tests/${testId}`)}>Cancel</Button>
          </div>
        </form>
      </ContentContainer>
    </AdminLayout>
  );
}
