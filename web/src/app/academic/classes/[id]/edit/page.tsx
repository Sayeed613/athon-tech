"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FormInput, FormSelect } from "@/components/forms/form-fields";
import { FormActions } from "@/components/forms/form-actions";
import { queryKeys } from "@/lib/query-keys";
import { classService } from "@/services/class.service";
import { academicService } from "@/services/academic.service";
import { teacherService } from "@/services/teacher.service";
import { useToast } from "@/hooks/use-toast";

// ── Zod Schema ────────────────────────────────────────────────

const editClassSchema = z.object({
  name: z.string().min(1, "Class name is required").max(50),
  section: z.string().max(20).optional().or(z.literal("")),
  academic_year_id: z.string().min(1, "Academic year is required"),
  class_teacher_id: z.string().optional().or(z.literal("")),
  room_number: z.string().max(20).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(100),
});

type EditClassFormData = z.infer<typeof editClassSchema>;

export default function EditClassPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const classId = params?.id as string;

  // ── Fetch Class Data ────────────────────────────────────────
  const {
    data: cls,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.classes.detail(classId),
    queryFn: () => classService.get(classId),
    enabled: !!classId,
  });

  // ── Fetch Reference Data ────────────────────────────────────
  const { data: yearsData } = useQuery({
    queryKey: queryKeys.academicYears.list(),
    queryFn: () => academicService.listYears(),
    staleTime: 60_000,
  });

  const { data: teachersData } = useQuery({
    queryKey: queryKeys.teachers.list({ limit: 200 }),
    queryFn: () => teacherService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const years = yearsData?.academic_years ?? [];
  const teachers = teachersData?.teachers ?? [];

  const yearOptions = useMemo(
    () => years.map((y) => ({ label: `${y.name}${y.is_current ? " (Current)" : ""}`, value: y.id })),
    [years]
  );

  const teacherOptions = useMemo(
    () => teachers.filter((t) => t.is_active).map((t) => ({
      label: `${t.first_name} ${t.last_name} (${t.employee_code})`,
      value: t.id,
    })),
    [teachers]
  );

  // ── Form ────────────────────────────────────────────────────
  const form = useForm<EditClassFormData>({
    resolver: zodResolver(editClassSchema),
    defaultValues: {
      name: "",
      section: "",
      academic_year_id: "",
      class_teacher_id: "",
      room_number: "",
      capacity: 30,
    },
    mode: "onBlur",
  });

  const { reset } = form;

  useEffect(() => {
    if (cls) {
      reset({
        name: cls.name,
        section: cls.section ?? "",
        academic_year_id: cls.academic_year_id,
        class_teacher_id: cls.class_teacher_id ?? "",
        room_number: cls.room_number ?? "",
        capacity: cls.capacity,
      });
    }
  }, [cls, reset]);

  // ── Update Mutation ─────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data: EditClassFormData) =>
      classService.update(classId, {
        name: data.name,
        section: data.section || undefined,
        academic_year_id: data.academic_year_id,
        class_teacher_id: data.class_teacher_id || undefined,
        room_number: data.room_number || undefined,
        capacity: data.capacity,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.detail(classId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast({ title: "Class updated", description: "Changes have been saved successfully.", variant: "success" });
      router.push(`/academic/classes/${classId}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: EditClassFormData) => {
    updateMutation.mutate(data);
  };

  // ── Loading ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer className="max-w-2xl">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-96 w-full rounded-xl" />
        </ContentContainer>
      </AdminLayout>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (isError || !cls) {
    return (
      <AdminLayout>
        <ContentContainer className="max-w-2xl">
          <PageHeader title="Class not found" description="The class could not be loaded." />
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Class not found."}
            </p>
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
        <PageHeader
          title={`Edit ${cls.name}${cls.section ? ` - ${cls.section}` : ""}`}
          description="Update class information."
        >
          <Button variant="outline" size="sm" onClick={() => router.push(`/academic/classes/${classId}`)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Cancel
          </Button>
        </PageHeader>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-4">Class Information</h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput<EditClassFormData> name="name" label="Class Name" placeholder="e.g., Grade 10" required />
                    <FormInput<EditClassFormData> name="section" label="Section" placeholder="e.g., A" />
                  </div>
                  <div className="mt-5">
                    <FormInput<EditClassFormData> name="room_number" label="Room Number" placeholder="e.g., 201" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-4">Capacity & Assignment</h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput<EditClassFormData> name="capacity" label="Student Capacity" type="number" required />
                    <FormSelect<EditClassFormData>
                      name="academic_year_id"
                      label="Academic Year"
                      placeholder="Select year..."
                      required
                      options={yearOptions}
                    />
                  </div>
                  <div className="mt-5">
                    <FormSelect<EditClassFormData>
                      name="class_teacher_id"
                      label="Class Teacher"
                      placeholder="Select teacher (optional)..."
                      options={teacherOptions}
                    />
                  </div>
                </div>

                <FormActions<EditClassFormData>
                  onSubmit={onSubmit}
                  isPending={updateMutation.isPending}
                  submitLabel={updateMutation.isPending ? "Saving..." : "Save Changes"}
                  onCancel={() => router.push(`/academic/classes/${classId}`)}
                />
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </ContentContainer>
    </AdminLayout>
  );
}
