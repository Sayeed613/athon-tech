"use client";

import { useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, ClipboardList, UserRound, Building2, BookOpen, CalendarCheck, AlertTriangle } from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormSelect, FormSwitch } from "@/components/forms/form-fields";
import { FormActions } from "@/components/forms/form-actions";
import { queryKeys } from "@/lib/query-keys";
import { assignmentService } from "@/services/assignment.service";
import { teacherService } from "@/services/teacher.service";
import { classService } from "@/services/class.service";
import { subjectService } from "@/services/subject.service";
import { academicService } from "@/services/academic.service";
import { useToast } from "@/hooks/use-toast";

// ── Zod Schema ────────────────────────────────────────────────
const createAssignmentSchema = z.object({
  teacher_id: z.string().min(1, "Teacher is required"),
  class_id: z.string().min(1, "Class is required"),
  subject_id: z.string().min(1, "Subject is required"),
  academic_term_id: z.string().min(1, "Academic term is required"),
  is_class_teacher: z.boolean().default(false),
});

type CreateAssignmentFormData = z.infer<typeof createAssignmentSchema>;

export default function CreateAssignmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Fetch Reference Data ────────────────────────────────────
  const { data: teachersData } = useQuery({
    queryKey: queryKeys.teachers.list({ limit: 200 }),
    queryFn: () => teacherService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: classesData } = useQuery({
    queryKey: queryKeys.classes.list({ limit: 200 }),
    queryFn: () => classService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: subjectsData } = useQuery({
    queryKey: queryKeys.subjects.list(),
    queryFn: () => subjectService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: termsData, isLoading: termsLoading } = useQuery({
    queryKey: queryKeys.academicTerms.list(),
    queryFn: () => academicService.listTerms(),
    staleTime: 60_000,
  });

  const teachers = teachersData?.teachers ?? [];
  const classes = classesData?.classes ?? [];
  const subjects = subjectsData?.subjects ?? [];
  const terms = termsData?.academic_terms ?? [];

  // ── Form ────────────────────────────────────────────────────
  const form = useForm<CreateAssignmentFormData>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      teacher_id: "",
      class_id: "",
      subject_id: "",
      academic_term_id: "",
      is_class_teacher: false,
    },
    mode: "onBlur",
  });

  const { watch } = form;
  const selectedTeacherId = watch("teacher_id");
  const selectedClassId = watch("class_id");
  const selectedSubjectId = watch("subject_id");
  const selectedTermId = watch("academic_term_id");

  // ── Load existing assignments for duplicate check ───────────
  const { data: existingAssignments } = useQuery({
    queryKey: queryKeys.assignments.list(),
    queryFn: () => assignmentService.list(),
    staleTime: 30_000,
  });

  // Check for duplicate
  const isDuplicate = useMemo(() => {
    if (!selectedTeacherId || !selectedClassId || !selectedSubjectId || !selectedTermId) return false;
    return (existingAssignments?.assignments ?? []).some(
      (a) =>
        a.teacher_id === selectedTeacherId &&
        a.class_id === selectedClassId &&
        a.subject_id === selectedSubjectId
    );
  }, [selectedTeacherId, selectedClassId, selectedSubjectId, selectedTermId, existingAssignments]);

  // Pre-select current term
  useEffect(() => {
    if (terms.length > 0 && !form.getValues("academic_term_id")) {
      const current = terms.find((t) => t.is_current);
      if (current) form.setValue("academic_term_id", current.id);
    }
  }, [terms, form]);

  // ── Options ─────────────────────────────────────────────────
  const teacherOptions = useMemo(
    () =>
      teachers
        .filter((t) => t.is_active)
        .map((t) => ({
          label: `${t.first_name} ${t.last_name} (${t.employee_code})`,
          value: t.id,
        })),
    [teachers]
  );

  const classOptions = useMemo(
    () =>
      classes.map((c) => ({
        label: c.section ? `${c.name} - ${c.section}` : c.name,
        value: c.id,
      })),
    [classes]
  );

  const subjectOptions = useMemo(
    () =>
      subjects.map((s) => ({
        label: `${s.name} (${s.code})`,
        value: s.id,
      })),
    [subjects]
  );

  const termOptions = useMemo(
    () =>
      terms.map((t) => ({
        label: `${t.name}${t.is_current ? " (Current)" : ""}`,
        value: t.id,
      })),
    [terms]
  );

  // ── Create Mutation ─────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateAssignmentFormData) =>
      assignmentService.create({
        teacher_id: data.teacher_id,
        class_id: data.class_id,
        subject_id: data.subject_id,
        academic_term_id: data.academic_term_id,
        is_class_teacher: data.is_class_teacher,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all });
      toast({ title: "Assignment created", description: "The teacher has been assigned.", variant: "success" });
      router.push("/academic/assignments");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create assignment", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CreateAssignmentFormData) => {
    if (isDuplicate) {
      toast({
        title: "Duplicate assignment",
        description: "This teacher is already assigned to this class and subject combination.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(data);
  };

  return (
    <AdminLayout>
      <ContentContainer className="max-w-2xl">
        <PageHeader title="Create Assignment" description="Assign a teacher to teach a subject in a class.">
          <Button variant="outline" size="sm" onClick={() => router.push("/academic/assignments")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <ClipboardList className="h-4 w-4 text-primary" /> Assignment Details
                  </h3>

                  <div className="space-y-5">
                    <FormSelect<CreateAssignmentFormData>
                      name="teacher_id"
                      label="Teacher"
                      placeholder="Select teacher..."
                      required
                      options={teacherOptions}
                    />

                    <div className="grid gap-5 sm:grid-cols-2">
                      <FormSelect<CreateAssignmentFormData>
                        name="class_id"
                        label="Class"
                        placeholder="Select class..."
                        required
                        options={classOptions}
                      />
                      <FormSelect<CreateAssignmentFormData>
                        name="subject_id"
                        label="Subject"
                        placeholder="Select subject..."
                        required
                        options={subjectOptions}
                      />
                    </div>

                    <FormSelect<CreateAssignmentFormData>
                      name="academic_term_id"
                      label="Academic Term"
                      placeholder={termsLoading ? "Loading terms..." : "Select term..."}
                      required
                      options={termOptions}
                    />

                    <FormSwitch<CreateAssignmentFormData>
                      name="is_class_teacher"
                      label="Class Teacher"
                      description="Mark this teacher as the class teacher (form teacher)."
                    />
                  </div>
                </div>

                {/* Duplicate Warning */}
                {isDuplicate && (
                  <div className="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/5 p-3 text-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
                    <div>
                      <p className="font-medium text-warning">Duplicate assignment detected</p>
                      <p className="mt-0.5 text-muted-foreground">
                        This teacher is already assigned to this class and subject. The backend will reject this
                        combination.
                      </p>
                    </div>
                  </div>
                )}

                <FormActions<CreateAssignmentFormData>
                  onSubmit={onSubmit}
                  isPending={createMutation.isPending}
                  submitLabel={createMutation.isPending ? "Creating..." : "Create Assignment"}
                  onCancel={() => router.push("/academic/assignments")}
                />
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </ContentContainer>
    </AdminLayout>
  );
}
