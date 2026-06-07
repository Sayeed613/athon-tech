"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, Book } from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormInput, FormTextarea, FormSwitch } from "@/components/forms/form-fields";
import { FormActions } from "@/components/forms/form-actions";
import { queryKeys } from "@/lib/query-keys";
import { subjectService } from "@/services/subject.service";
import { useToast } from "@/hooks/use-toast";

const createSubjectSchema = z.object({
  name: z.string().min(1, "Subject name is required").max(100),
  code: z.string().min(1, "Subject code is required").max(20).toUpperCase(),
  description: z.string().max(1000).optional().or(z.literal("")),
  is_core: z.boolean().default(true),
});

type CreateSubjectFormData = z.infer<typeof createSubjectSchema>;

export default function CreateSubjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CreateSubjectFormData>({
    resolver: zodResolver(createSubjectSchema),
    defaultValues: { name: "", code: "", description: "", is_core: true },
    mode: "onBlur",
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSubjectFormData) =>
      subjectService.create({
        name: data.name,
        code: data.code,
        description: data.description || undefined,
        is_core: data.is_core,
      }),
    onSuccess: (subject) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subjects.all });
      toast({ title: "Subject created", description: `${subject.name} has been added.`, variant: "success" });
      router.push(`/academic/subjects/${subject.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create subject", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CreateSubjectFormData) => createMutation.mutate(data);

  return (
    <AdminLayout>
      <ContentContainer className="max-w-2xl">
        <PageHeader title="Add Subject" description="Create a new academic subject.">
          <Button variant="outline" size="sm" onClick={() => router.push("/academic/subjects")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <Book className="h-4 w-4 text-primary" /> Subject Information
                  </h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput<CreateSubjectFormData> name="name" label="Subject Name" placeholder="e.g., Mathematics" required />
                    <FormInput<CreateSubjectFormData> name="code" label="Subject Code" placeholder="e.g., MATH" required />
                  </div>
                  <div className="mt-5">
                    <FormTextarea<CreateSubjectFormData>
                      name="description"
                      label="Description"
                      placeholder="Optional description of the subject..."
                    />
                  </div>
                  <div className="mt-5">
                    <FormSwitch<CreateSubjectFormData>
                      name="is_core"
                      label="Core Subject"
                      description="Core subjects are compulsory for all students."
                    />
                  </div>
                </div>

                <FormActions<CreateSubjectFormData>
                  onSubmit={onSubmit}
                  isPending={createMutation.isPending}
                  submitLabel={createMutation.isPending ? "Creating..." : "Create Subject"}
                  onCancel={() => router.push("/academic/subjects")}
                />
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </ContentContainer>
    </AdminLayout>
  );
}
