"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FormInput, FormTextarea, FormSwitch } from "@/components/forms/form-fields";
import { FormActions } from "@/components/forms/form-actions";
import { queryKeys } from "@/lib/query-keys";
import { subjectService } from "@/services/subject.service";
import { useToast } from "@/hooks/use-toast";

const editSubjectSchema = z.object({
  name: z.string().min(1, "Subject name is required").max(100),
  code: z.string().min(1, "Subject code is required").max(20).toUpperCase(),
  description: z.string().max(1000).optional().or(z.literal("")),
  is_core: z.boolean(),
});

type EditSubjectFormData = z.infer<typeof editSubjectSchema>;

export default function EditSubjectPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const subjectId = params?.id as string;

  const { data: subject, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.subjects.detail(subjectId),
    queryFn: () => subjectService.get(subjectId),
    enabled: !!subjectId,
  });

  const form = useForm<EditSubjectFormData>({
    resolver: zodResolver(editSubjectSchema),
    defaultValues: { name: "", code: "", description: "", is_core: true },
    mode: "onBlur",
  });

  const { reset } = form;

  useEffect(() => {
    if (subject) {
      reset({
        name: subject.name,
        code: subject.code,
        description: subject.description ?? "",
        is_core: subject.is_core,
      });
    }
  }, [subject, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: EditSubjectFormData) =>
      subjectService.update(subjectId, {
        name: data.name,
        code: data.code,
        description: data.description || undefined,
        is_core: data.is_core,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subjects.all });
      toast({ title: "Subject updated", description: "Changes saved.", variant: "success" });
      router.push(`/academic/subjects/${subjectId}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: EditSubjectFormData) => updateMutation.mutate(data);

  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer className="max-w-2xl">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-80 w-full rounded-xl" />
        </ContentContainer>
      </AdminLayout>
    );
  }

  if (isError || !subject) {
    return (
      <AdminLayout>
        <ContentContainer className="max-w-2xl">
          <PageHeader title="Subject not found" description="The subject could not be loaded." />
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Subject not found."}</p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
              <Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
            </div>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ContentContainer className="max-w-2xl">
        <PageHeader title={`Edit ${subject.name}`} description="Update subject information.">
          <Button variant="outline" size="sm" onClick={() => router.push(`/academic/subjects/${subjectId}`)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Cancel
          </Button>
        </PageHeader>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormInput<EditSubjectFormData> name="name" label="Subject Name" placeholder="e.g., Mathematics" required />
                  <FormInput<EditSubjectFormData> name="code" label="Subject Code" placeholder="e.g., MATH" required />
                </div>
                <FormTextarea<EditSubjectFormData> name="description" label="Description" placeholder="Optional description..." />
                <FormSwitch<EditSubjectFormData> name="is_core" label="Core Subject" description="Core subjects are compulsory for all students." />

                <FormActions<EditSubjectFormData>
                  onSubmit={onSubmit}
                  isPending={updateMutation.isPending}
                  submitLabel={updateMutation.isPending ? "Saving..." : "Save Changes"}
                  onCancel={() => router.push(`/academic/subjects/${subjectId}`)}
                />
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </ContentContainer>
    </AdminLayout>
  );
}
