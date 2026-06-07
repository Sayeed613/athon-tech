"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import {
  ArrowLeft,
  Loader2,
  Check,
  Building2,
  Users,
  BookOpen,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormInput, FormSelect } from "@/components/forms/form-fields";
import { FormActions } from "@/components/forms/form-actions";
import { queryKeys } from "@/lib/query-keys";
import { classService } from "@/services/class.service";
import { academicService } from "@/services/academic.service";
import { teacherService } from "@/services/teacher.service";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo } from "react";

// ── Zod Schema ────────────────────────────────────────────────

const createClassSchema = z.object({
  name: z.string().min(1, "Class name is required").max(50),
  section: z.string().max(20).optional().or(z.literal("")),
  academic_year_id: z.string().min(1, "Academic year is required"),
  class_teacher_id: z.string().optional().or(z.literal("")),
  room_number: z.string().max(20).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1, "Minimum 1").max(100, "Maximum 100").default(30),
});

type CreateClassFormData = z.infer<typeof createClassSchema>;

export default function CreateClassPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Fetch reference data ────────────────────────────────────
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
  const form = useForm<CreateClassFormData>({
    resolver: zodResolver(createClassSchema),
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

  // Pre-select current academic year
  useEffect(() => {
    if (years.length > 0 && !form.getValues("academic_year_id")) {
      const current = years.find((y) => y.is_current);
      if (current) form.setValue("academic_year_id", current.id);
    }
  }, [years, form]);

  // ── Create Mutation ─────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateClassFormData) =>
      classService.create({
        name: data.name,
        section: data.section || undefined,
        academic_year_id: data.academic_year_id,
        class_teacher_id: data.class_teacher_id || undefined,
        room_number: data.room_number || undefined,
        capacity: data.capacity,
      }),
    onSuccess: (cls) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast({ title: "Class created", description: `${cls.name} has been added successfully.`, variant: "success" });
      router.push(`/academic/classes/${cls.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create class", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CreateClassFormData) => {
    createMutation.mutate(data);
  };

  return (
    <AdminLayout>
      <ContentContainer className="max-w-2xl">
        <PageHeader
          title="Add Class"
          description="Create a new class group."
        >
          <Button variant="outline" size="sm" onClick={() => router.push("/academic/classes")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <Building2 className="h-4 w-4 text-primary" /> Class Information
                  </h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput<CreateClassFormData>
                      name="name"
                      label="Class Name"
                      placeholder="e.g., Grade 10"
                      required
                    />
                    <FormInput<CreateClassFormData>
                      name="section"
                      label="Section"
                      placeholder="e.g., A"
                    />
                  </div>
                  <div className="mt-5">
                    <FormInput<CreateClassFormData>
                      name="room_number"
                      label="Room Number"
                      placeholder="e.g., 201"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-primary" /> Capacity & Assignment
                  </h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput<CreateClassFormData>
                      name="capacity"
                      label="Student Capacity"
                      type="number"
                      required
                    />
                    <FormSelect<CreateClassFormData>
                      name="academic_year_id"
                      label="Academic Year"
                      placeholder="Select year..."
                      required
                      options={yearOptions}
                    />
                  </div>
                  <div className="mt-5">
                    <FormSelect<CreateClassFormData>
                      name="class_teacher_id"
                      label="Class Teacher"
                      placeholder="Select teacher (optional)..."
                      options={teacherOptions}
                    />
                  </div>
                </div>

                <FormActions<CreateClassFormData>
                  onSubmit={onSubmit}
                  isPending={createMutation.isPending}
                  submitLabel={createMutation.isPending ? "Creating..." : "Create Class"}
                  onCancel={() => router.push("/academic/classes")}
                />
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </ContentContainer>
    </AdminLayout>
  );
}
