"use client";

import { useEffect } from "react";
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
import { FormInput } from "@/components/forms/form-fields";
import { FormActions } from "@/components/forms/form-actions";
import { queryKeys } from "@/lib/query-keys";
import { teacherService } from "@/services/teacher.service";
import { useToast } from "@/hooks/use-toast";

// ── Zod Schema ────────────────────────────────────────────────

const editTeacherSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  phone: z
    .string()
    .max(20, "Phone number is too long")
    .optional()
    .or(z.literal("")),
  employee_code: z
    .string()
    .min(1, "Employee code is required")
    .max(30),
  qualification: z
    .string()
    .max(200)
    .optional()
    .or(z.literal("")),
  specialization: z
    .string()
    .max(200)
    .optional()
    .or(z.literal("")),
  hire_date: z.string().min(1, "Hire date is required"),
});

type EditTeacherFormData = z.infer<typeof editTeacherSchema>;

export default function EditTeacherPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const teacherId = params?.id as string;

  // ── Fetch Teacher Data ──────────────────────────────────────
  const {
    data: teacher,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.teachers.detail(teacherId),
    queryFn: () => teacherService.get(teacherId),
    enabled: !!teacherId,
  });

  // ── Form ────────────────────────────────────────────────────
  const form = useForm<EditTeacherFormData>({
    resolver: zodResolver(editTeacherSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      phone: "",
      employee_code: "",
      qualification: "",
      specialization: "",
      hire_date: "",
    },
    mode: "onBlur",
  });

  const { reset } = form;

  // Populate form when teacher data loads
  useEffect(() => {
    if (teacher) {
      reset({
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        phone: teacher.phone ?? "",
        employee_code: teacher.employee_code,
        qualification: teacher.qualification ?? "",
        specialization: teacher.specialization ?? "",
        hire_date: teacher.hire_date
          ? teacher.hire_date.split("T")[0]
          : "",
      });
    }
  }, [teacher, reset]);

  // ── Update Mutation ─────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data: EditTeacherFormData) =>
      teacherService.update(teacherId, {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || undefined,
        employee_code: data.employee_code,
        qualification: data.qualification || undefined,
        specialization: data.specialization || undefined,
        hire_date: data.hire_date,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.teachers.detail(teacherId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all });
      toast({
        title: "Teacher updated",
        description: "Profile changes have been saved successfully.",
        variant: "success",
      });
      router.push(`/users/teachers/${teacherId}`);
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to update",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditTeacherFormData) => {
    updateMutation.mutate(data);
  };

  // ── Loading State ───────────────────────────────────────────
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

  // ── Error State ─────────────────────────────────────────────
  if (isError || !teacher) {
    return (
      <AdminLayout>
        <ContentContainer className="max-w-2xl">
          <PageHeader
            title="Teacher not found"
            description="The teacher profile could not be loaded."
          />
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-sm text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Teacher not found or you don't have access."}
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.back()}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  const fullName = `${teacher.first_name} ${teacher.last_name}`;

  return (
    <AdminLayout>
      <ContentContainer className="max-w-2xl">
        <PageHeader
          title={`Edit ${fullName}`}
          description="Update teacher profile information."
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/users/teachers/${teacherId}`)}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Cancel
          </Button>
        </PageHeader>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <FormProvider {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {/* Personal Information */}
                <div>
                  <h3 className="text-sm font-semibold mb-4">
                    Personal Information
                  </h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput<EditTeacherFormData>
                      name="first_name"
                      label="First Name"
                      placeholder="John"
                      required
                    />
                    <FormInput<EditTeacherFormData>
                      name="last_name"
                      label="Last Name"
                      placeholder="Doe"
                      required
                    />
                  </div>
                  <div className="mt-5">
                    <FormInput<EditTeacherFormData>
                      name="phone"
                      label="Phone Number"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                {/* Professional Information */}
                <div>
                  <h3 className="text-sm font-semibold mb-4">
                    Professional Information
                  </h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput<EditTeacherFormData>
                      name="employee_code"
                      label="Employee Code"
                      placeholder="TCH-001"
                      required
                    />
                    <FormInput<EditTeacherFormData>
                      name="hire_date"
                      label="Hire Date"
                      required
                      type="date"
                    />
                  </div>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <FormInput<EditTeacherFormData>
                      name="qualification"
                      label="Qualification"
                      placeholder="e.g., M.Sc. in Mathematics"
                    />
                    <FormInput<EditTeacherFormData>
                      name="specialization"
                      label="Specialization"
                      placeholder="e.g., Mathematics"
                    />
                  </div>
                </div>

                <FormActions<EditTeacherFormData>
                  onSubmit={onSubmit}
                  isPending={updateMutation.isPending}
                  submitLabel={updateMutation.isPending ? "Saving..." : "Save Changes"}
                  onCancel={() =>
                    router.push(`/users/teachers/${teacherId}`)
                  }
                />
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </ContentContainer>
    </AdminLayout>
  );
}
