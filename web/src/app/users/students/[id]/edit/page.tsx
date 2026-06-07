"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FormInput } from "@/components/forms/form-fields";
import { FormActions } from "@/components/forms/form-actions";
import http from "@/lib/axios";
import { queryKeys } from "@/lib/query-keys";
import { studentService } from "@/services/student.service";
import { useToast } from "@/hooks/use-toast";

const editStudentSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  phone: z.string().max(20).optional().or(z.literal("")),
  admission_number: z.string().min(1, "Admission number is required").max(30),
  class_id: z.string().min(1, "Class is required"),
  roll_number: z.string().max(10).optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
});

type EditStudentFormData = z.infer<typeof editStudentSchema>;

export default function EditStudentPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const studentId = params?.id as string;

  const { data: student, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.students.detail(studentId),
    queryFn: () => studentService.get(studentId),
    enabled: !!studentId,
  });

  const { data: classes } = useQuery({
    queryKey: queryKeys.classes.list(),
    queryFn: async () => {
      const { data } = await http.get<{ classes: { id: string; name: string; section: string | null }[] }>("/classes");
      return data.classes;
    },
    staleTime: 60_000,
  });

  const form = useForm<EditStudentFormData>({
    resolver: zodResolver(editStudentSchema),
    defaultValues: { first_name: "", last_name: "", phone: "", admission_number: "", class_id: "", roll_number: "", date_of_birth: "", gender: "" },
    mode: "onBlur",
  });

  const { reset, setValue, getValues } = form;

  useEffect(() => {
    if (student) {
      reset({
        first_name: student.first_name,
        last_name: student.last_name,
        phone: student.phone || "" as string | undefined,
        admission_number: student.admission_number,
        class_id: student.class_id,
        roll_number: student.roll_number || "" as string | undefined,
        date_of_birth: student.date_of_birth?.split("T")[0] ?? "",
        gender: student.gender || "" as string | undefined,
      });
    }
  }, [student, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: EditStudentFormData) =>
      studentService.update(studentId, {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || undefined,
        admission_number: data.admission_number,
        class_id: data.class_id,
        roll_number: data.roll_number || undefined,
        date_of_birth: data.date_of_birth || undefined,
        gender: data.gender || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(studentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      toast({ title: "Student updated", description: "Profile changes saved.", variant: "success" });
      router.push(`/users/students/${studentId}`);
    },
    onError: (err: Error) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const onSubmit = (data: EditStudentFormData) => updateMutation.mutate(data);

  if (isLoading) return (
    <AdminLayout>
      <ContentContainer className="max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-96 w-full rounded-xl" />
      </ContentContainer>
    </AdminLayout>
  );

  if (isError || !student) return (
    <AdminLayout>
      <ContentContainer className="max-w-2xl">
        <PageHeader title="Student not found" description="The student profile could not be loaded." />
        <div className="mt-12 flex flex-col items-center justify-center text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="mt-4 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Student not found."}</p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
            <Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
          </div>
        </div>
      </ContentContainer>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <ContentContainer className="max-w-2xl">
        <PageHeader
          title={`Edit ${student.first_name} ${student.last_name}`}
          description="Update student profile information."
        >
          <Button variant="outline" size="sm" onClick={() => router.push(`/users/students/${studentId}`)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Cancel
          </Button>
        </PageHeader>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-4">Personal Information</h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput<EditStudentFormData> name="first_name" label="First Name" placeholder="John" required />
                    <FormInput<EditStudentFormData> name="last_name" label="Last Name" placeholder="Doe" required />
                  </div>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <FormInput<EditStudentFormData> name="date_of_birth" label="Date of Birth" type="date" />
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Gender</label>
                      <Select value={getValues("gender")} onValueChange={(v) => setValue("gender", v || "")}>
                        <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-4">Enrollment Information</h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput<EditStudentFormData> name="admission_number" label="Admission Number" placeholder="STU-001" required />
                    <FormInput<EditStudentFormData> name="roll_number" label="Roll Number" placeholder="Optional" />
                  </div>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Class <span className="text-destructive">*</span></label>
                      <Select value={getValues("class_id")} onValueChange={(v) => setValue("class_id", v || "")}>
                        <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                        <SelectContent>
                          {classes?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <FormInput<EditStudentFormData> name="phone" label="Phone Number" placeholder="+1 (555) 123-4567" />
                  </div>
                </div>

                <FormActions<EditStudentFormData>
                  onSubmit={onSubmit}
                  isPending={updateMutation.isPending}
                  submitLabel={updateMutation.isPending ? "Saving..." : "Save Changes"}
                  onCancel={() => router.push(`/users/students/${studentId}`)}
                />
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </ContentContainer>
    </AdminLayout>
  );
}
