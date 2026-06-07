"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { homeworkService } from "@/services/homework.service";
import type { UpdateHomeworkRequest } from "@/types/homework";

export default function EditHomeworkPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useUserRole();

  // Only teachers can edit homework
  if (!role.isTeacher) {
    router.replace("/homework");
    return null;
  }
  const { toast } = useToast();
  const homeworkId = params.id as string;

  const [form, setForm] = useState({
    title: "",
    description: "",
    due_date: "",
    max_score: 100,
    is_published: false,
  });
  const [initialized, setInitialized] = useState(false);

  const { data: hw, isLoading } = useQuery({
    queryKey: queryKeys.homework.detail(homeworkId),
    queryFn: () => homeworkService.get(homeworkId),
    enabled: !!homeworkId,
  });

  useEffect(() => {
    if (hw && !initialized) {
      setForm({
        title: hw.title,
        description: hw.description ?? "",
        due_date: hw.due_date ? new Date(hw.due_date).toISOString().slice(0, 16) : "",
        max_score: hw.max_score,
        is_published: hw.is_published,
      });
      setInitialized(true);
    }
  }, [hw, initialized]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateHomeworkRequest) => homeworkService.update(homeworkId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.homework.detail(homeworkId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.homework.all });
      toast({ title: "Updated", description: "Homework updated successfully." });
      router.push(`/homework/${homeworkId}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.due_date) {
      toast({ title: "Missing fields", description: "Title and due date are required.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      title: form.title,
      description: form.description || undefined,
      due_date: new Date(form.due_date).toISOString(),
      max_score: form.max_score,
      is_published: form.is_published,
    });
  };

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <Skeleton className="h-8 w-48" />
          <div className="mt-6 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader title="Edit Homework" description={hw?.title ?? ""}>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/homework/${homeworkId}`)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Homework Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Due Date <span className="text-destructive">*</span></Label>
                  <Input type="datetime-local" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Max Score</Label>
                  <Input type="number" min={1} value={form.max_score} onChange={(e) => set("max_score", parseInt(e.target.value) || 100)} />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Switch checked={form.is_published} onCheckedChange={(v) => set("is_published", v)} id="published" />
                <Label htmlFor="published" className="cursor-pointer">Published (visible to students)</Label>
              </div>
            </CardContent>
          </Card>

          {updateMutation.isError && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              <p className="text-destructive">{updateMutation.error?.message}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" type="button" onClick={() => router.push(`/homework/${homeworkId}`)}>
              Cancel
            </Button>
          </div>
        </form>
      </ContentContainer>
    </AdminLayout>
  );
}
