"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, ArrowRight, Check, UserRound, Users, BookOpen, FileText, Loader2, GraduationCap,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import http from "@/lib/axios";
import { FormInput, FormSelect } from "@/components/forms/form-fields";
import { queryKeys } from "@/lib/query-keys";
import { studentService } from "@/services/student.service";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Schema All Fields ─────────────────────────────────────────

const createStudentSchema = z.object({
  // Step 1: Student Information
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  date_of_birth: z.string().optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),

  // Step 2: Parent / Contact (no backend fields, shown as info)
  phone: z.string().max(20).optional().or(z.literal("")),

  // Step 3: Class Assignment
  admission_number: z.string().min(1, "Admission number is required").max(30),
  class_id: z.string().min(1, "Class is required"),
  roll_number: z.string().max(10).optional().or(z.literal("")),

  // Step 4: Review
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  enrollment_date: z.string().optional().or(z.literal("")),
});

type CreateStudentFormData = z.infer<typeof createStudentSchema>;

const STEPS = [
  { id: 1, label: "Student Information", icon: UserRound },
  { id: 2, label: "Parent Information", icon: Users },
  { id: 3, label: "Class Assignment", icon: BookOpen },
  { id: 4, label: "Review & Confirm", icon: FileText },
];

export default function CreateStudentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);

  const form = useForm<CreateStudentFormData>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: {
      first_name: "", last_name: "", date_of_birth: "", gender: "",
      phone: "", admission_number: "", class_id: "", roll_number: "",
      email: "", password: "", enrollment_date: "",
    },
    mode: "onBlur",
  });

  const { trigger, getValues, setValue } = form;

  // ── Fetch classes for dropdown ──────────────────────────────
  const { data: classes } = useQuery({
    queryKey: queryKeys.classes.list(),
    queryFn: async () => {
      const { data } = await http.get<{ classes: { id: string; name: string; section: string | null }[] }>("/classes");
      return data.classes;
    },
    staleTime: 60_000,
  });

  // ── Create Mutation ─────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateStudentFormData) =>
      studentService.create({
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || undefined,
        admission_number: data.admission_number,
        class_id: data.class_id,
        roll_number: data.roll_number || undefined,
        date_of_birth: data.date_of_birth || undefined,
        gender: data.gender || undefined,
        enrollment_date: data.enrollment_date || undefined,
      }),
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      toast({ title: "Student created", description: `${student.first_name} ${student.last_name} has been enrolled.`, variant: "success" });
      router.push(`/users/students/${student.id}`);
    },
    onError: (err: Error) => toast({ title: "Failed to create student", description: err.message, variant: "destructive" }),
  });

  // ── Step Navigation ─────────────────────────────────────────
  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1: return await trigger(["first_name", "last_name", "date_of_birth", "gender"]);
      case 2: return true; // No required fields
      case 3: return await trigger(["admission_number", "class_id", "roll_number"]);
      case 4: return await trigger(["email", "password", "enrollment_date"]);
      default: return true;
    }
  };

  const handleNext = async () => {
    const valid = await validateStep(currentStep);
    if (valid) setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const handleSubmit = () => {
    const data = getValues();
    createMutation.mutate(data);
  };

  const renderSteps = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          const Icon = step.icon;
          return (
            <div key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors", isCompleted && "border-success bg-success text-success-foreground", isActive && "border-primary bg-primary text-primary-foreground", !isActive && !isCompleted && "border-border bg-background text-muted-foreground")}>
                  {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span className={cn("mt-2 text-xs font-medium hidden sm:block", isActive && "text-primary", isCompleted && "text-success", !isActive && !isCompleted && "text-muted-foreground")}>{step.label}</span>
              </div>
              {idx < STEPS.length - 1 && <div className={cn("mx-4 h-px flex-1", isCompleted ? "bg-success" : "bg-border")} />}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormInput<CreateStudentFormData> name="first_name" label="First Name" placeholder="John" required />
              <FormInput<CreateStudentFormData> name="last_name" label="Last Name" placeholder="Doe" required />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormInput<CreateStudentFormData> name="date_of_birth" label="Date of Birth" type="date" />
              <div>
                <label className="text-sm font-medium mb-1.5 block">Gender <span className="text-muted-foreground">(optional)</span></label>
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
        );

      case 2:
        return (
          <div className="space-y-5">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-primary" /> Parent Linking</h3>
              <p className="text-sm text-muted-foreground">After the student is created, you can link parents to this student from the student's profile page or the Parent Linking section.</p>
            </div>
            <FormInput<CreateStudentFormData> name="phone" label="Student's Phone Number" placeholder="+1 (555) 123-4567" description="Optional contact number for the student." />
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <FormInput<CreateStudentFormData> name="admission_number" label="Admission Number" placeholder="STU-001" required description="Must be unique within the school." />
            <div className="grid gap-5 sm:grid-cols-2">
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
              <FormInput<CreateStudentFormData> name="roll_number" label="Roll Number" placeholder="Optional" />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><GraduationCap className="h-4 w-4 text-primary" /> Account & Enrollment</h3>
              <p className="text-sm text-muted-foreground">The student will receive a User account with the credentials below. An enrollment record will be created for the selected class.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /> Personal Info</h3>
              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">Name: </span><span className="font-medium">{getValues("first_name")} {getValues("last_name")}</span></div>
                <div><span className="text-muted-foreground">Gender: </span><span className="font-medium capitalize">{getValues("gender") || <span className="italic text-muted-foreground">Not specified</span>}</span></div>
                <div><span className="text-muted-foreground">DOB: </span><span className="font-medium">{getValues("date_of_birth") || <span className="italic text-muted-foreground">Not recorded</span>}</span></div>
                <div><span className="text-muted-foreground">Phone: </span><span className="font-medium">{getValues("phone") || <span className="italic text-muted-foreground">Not provided</span>}</span></div>
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Class Assignment</h3>
              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">Class: </span><span className="font-medium">{classes?.find((c) => c.id === getValues("class_id"))?.name || getValues("class_id")}</span></div>
                <div><span className="text-muted-foreground">Admission #: </span><span className="font-medium">{getValues("admission_number")}</span></div>
                <div><span className="text-muted-foreground">Roll #: </span><span className="font-medium">{getValues("roll_number") || <span className="italic text-muted-foreground">Not assigned</span>}</span></div>
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Account Credentials</h3>
              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">Email: </span><span className="font-medium">{getValues("email")}</span></div>
                <div><span className="text-muted-foreground">Enrollment: </span><span className="font-medium">{getValues("enrollment_date") || "Today (default)"}</span></div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <AdminLayout>
      <ContentContainer className="max-w-2xl">
        <PageHeader title="Add Student" description="Enroll a new student with a User account and class assignment.">
          <Button variant="outline" size="sm" onClick={() => router.push("/users/students")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <div className="mt-8">{renderSteps()}</div>

        <FormProvider {...form}>
          <Card><CardContent className="pt-6">{renderStepContent()}</CardContent></Card>

          <div className="mt-6 flex items-center justify-between">
            <Button variant="outline" onClick={handleBack} disabled={currentStep === 1} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {currentStep < 4 ? (
              <Button onClick={handleNext} className="gap-2">Next <ArrowRight className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={handleSubmit} disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {createMutation.isPending ? "Creating..." : "Create Student"}
              </Button>
            )}
          </div>
        </FormProvider>
      </ContentContainer>
    </AdminLayout>
  );
}
