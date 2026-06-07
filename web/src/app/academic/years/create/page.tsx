"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, Calendar } from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormInput, FormSwitch } from "@/components/forms/form-fields";
import { FormActions } from "@/components/forms/form-actions";
import { academicService } from "@/services/academic.service";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/hooks/use-toast";

const createYearSchema = z.object({
  name: z.string().min(1, "Year name is required").max(50),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  is_current: z.boolean().default(false),
});

type CreateYearFormData = z.infer<typeof createYearSchema>;

export default function CreateAcademicYearPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CreateYearFormData>({
    resolver: zodResolver(createYearSchema),
    defaultValues: { name: "", start_date: "", end_date: "", is_current: false },
    mode: "onBlur",
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateYearFormData) =>
      academicService.createYear({
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        is_current: data.is_current,
      }),
    onSuccess: (year) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academicYears.all });
      toast({ title: "Academic year created", description: `${year.name} has been added.`, variant: "success" });
      router.push("/academic/years");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CreateYearFormData) => createMutation.mutate(data);

  return (
    <AdminLayout>
      <ContentContainer className="max-w-2xl">
        <PageHeader title="Add Academic Year" description="Create a new academic year.">
          <Button variant="outline" size="sm" onClick={() => router.push("/academic/years")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <Calendar className="h-4 w-4 text-primary" /> Year Information
                  </h3>
                  <FormInput<CreateYearFormData> name="name" label="Year Name" placeholder="e.g., 2025-2026" required />
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <FormInput<CreateYearFormData> name="start_date" label="Start Date" required type="date" />
                    <FormInput<CreateYearFormData> name="end_date" label="End Date" required type="date" />
                  </div>
                  <div className="mt-5">
                    <FormSwitch<CreateYearFormData>
                      name="is_current"
                      label="Set as Current Year"
                      description="Mark this as the active academic year."
                    />
                  </div>
                </div>

                <FormActions<CreateYearFormData>
                  onSubmit={onSubmit}
                  isPending={createMutation.isPending}
                  submitLabel={createMutation.isPending ? "Creating..." : "Create Year"}
                  onCancel={() => router.push("/academic/years")}
                />
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </ContentContainer>
    </AdminLayout>
  );
}
