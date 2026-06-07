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
import { FormInput, FormSwitch } from "@/components/forms/form-fields";
import { FormActions } from "@/components/forms/form-actions";
import { academicService } from "@/services/academic.service";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/hooks/use-toast";

const editYearSchema = z.object({
  name: z.string().min(1, "Year name is required").max(50),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  is_current: z.boolean(),
});

type EditYearFormData = z.infer<typeof editYearSchema>;

export default function EditAcademicYearPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const yearId = params?.id as string;

  const { data: year, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.academicYears.detail(yearId),
    queryFn: () => academicService.getYear(yearId),
    enabled: !!yearId,
    staleTime: 30_000,
  });

  const form = useForm<EditYearFormData>({
    resolver: zodResolver(editYearSchema),
    defaultValues: { name: "", start_date: "", end_date: "", is_current: false },
    mode: "onBlur",
  });

  const { reset } = form;

  useEffect(() => {
    if (year) {
      reset({
        name: year.name,
        start_date: year.start_date,
        end_date: year.end_date,
        is_current: year.is_current,
      });
    }
  }, [year, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: EditYearFormData) =>
      academicService.updateYear(yearId, {
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        is_current: data.is_current,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academicYears.all });
      toast({ title: "Year updated", description: "Changes saved.", variant: "success" });
      router.push(`/academic/years/${yearId}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: EditYearFormData) => updateMutation.mutate(data);

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

  if (isError || !year) {
    return (
      <AdminLayout>
        <ContentContainer className="max-w-2xl">
          <PageHeader title="Year not found" description="The academic year could not be loaded." />
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Year not found."}</p>
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
        <PageHeader title={`Edit ${year.name}`} description="Update academic year information.">
          <Button variant="outline" size="sm" onClick={() => router.push(`/academic/years/${yearId}`)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Cancel
          </Button>
        </PageHeader>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormInput<EditYearFormData> name="name" label="Year Name" placeholder="e.g., 2025-2026" required />
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormInput<EditYearFormData> name="start_date" label="Start Date" required type="date" />
                  <FormInput<EditYearFormData> name="end_date" label="End Date" required type="date" />
                </div>
                <FormSwitch<EditYearFormData>
                  name="is_current"
                  label="Set as Current Year"
                  description="Mark this as the active academic year."
                />

                <FormActions<EditYearFormData>
                  onSubmit={onSubmit}
                  isPending={updateMutation.isPending}
                  submitLabel={updateMutation.isPending ? "Saving..." : "Save Changes"}
                  onCancel={() => router.push(`/academic/years/${yearId}`)}
                />
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </ContentContainer>
    </AdminLayout>
  );
}
