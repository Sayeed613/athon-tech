"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  UserRound,
  ShieldCheck,
  FileText,
  Loader2,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FormInput } from "@/components/forms/form-fields";
import { queryKeys } from "@/lib/query-keys";
import { teacherService } from "@/services/teacher.service";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Zod Schema ────────────────────────────────────────────────

const createTeacherSchema = z.object({
  // Step 1: Personal Information
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  phone: z
    .string()
    .max(20, "Phone number is too long")
    .optional()
    .or(z.literal("")),
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

  // Step 2: Account Information
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
  employee_code: z
    .string()
    .min(1, "Employee code is required")
    .max(30),
  hire_date: z.string().min(1, "Hire date is required"),
});

type CreateTeacherFormData = z.infer<typeof createTeacherSchema>;

// ── Steps ─────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Personal Information", icon: UserRound },
  { id: 2, label: "Account Information", icon: ShieldCheck },
  { id: 3, label: "Assignment Information", icon: FileText },
];

export default function CreateTeacherPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);

  const form = useForm<CreateTeacherFormData>({
    resolver: zodResolver(createTeacherSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      phone: "",
      qualification: "",
      specialization: "",
      email: "",
      password: "",
      employee_code: "",
      hire_date: "",
    },
    mode: "onBlur",
  });

  const {
    trigger,
    getValues,
  } = form;

  // ── Create Mutation ─────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateTeacherFormData) =>
      teacherService.create({
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || undefined,
        employee_code: data.employee_code,
        qualification: data.qualification || undefined,
        specialization: data.specialization || undefined,
        hire_date: data.hire_date,
      }),
    onSuccess: (teacher) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all });
      toast({
        title: "Teacher created",
        description: `${teacher.first_name} ${teacher.last_name} has been added successfully.`,
        variant: "success",
      });
      router.push(`/users/teachers/${teacher.id}`);
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to create teacher",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // ── Step Navigation ─────────────────────────────────────────
  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1:
        return await trigger([
          "first_name",
          "last_name",
          "phone",
          "qualification",
          "specialization",
        ]);
      case 2:
        return await trigger([
          "email",
          "password",
          "employee_code",
          "hire_date",
        ]);
      default:
        return true;
    }
  };

  const handleNext = async () => {
    const valid = await validateStep(currentStep);
    if (valid) setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    const data = getValues();
    createMutation.mutate(data);
  };

  // ── Render: Step Indicators ─────────────────────────────────
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
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted &&
                      "border-success bg-success text-success-foreground",
                    isActive && "border-primary bg-primary text-primary-foreground",
                    !isActive && !isCompleted && "border-border bg-background text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium hidden sm:block",
                    isActive && "text-primary",
                    isCompleted && "text-success",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-4 h-px flex-1",
                    isCompleted ? "bg-success" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Render: Step Content ────────────────────────────────────
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormInput<CreateTeacherFormData>
                name="first_name"
                label="First Name"
                placeholder="John"
                required
              />
              <FormInput<CreateTeacherFormData>
                name="last_name"
                label="Last Name"
                placeholder="Doe"
                required
              />
            </div>
            <FormInput<CreateTeacherFormData>
              name="phone"
              label="Phone Number"
              placeholder="+1 (555) 123-4567"
              description="Optional. Used for emergency contact."
            />
            <FormInput<CreateTeacherFormData>
              name="qualification"
              label="Qualification"
              placeholder="e.g., M.Sc. in Mathematics"
              description="Optional. Educational background."
            />
            <FormInput<CreateTeacherFormData>
              name="specialization"
              label="Specialization"
              placeholder="e.g., Mathematics"
              description="Optional. Subject specialization."
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <FormInput<CreateTeacherFormData>
              name="email"
              label="Email Address"
              placeholder="john.doe@school.edu"
              required
              type="email"
              description="Used for login. Must be unique."
            />
            <FormInput<CreateTeacherFormData>
              name="password"
              label="Temporary Password"
              placeholder="Minimum 6 characters"
              required
              type="password"
              description="The teacher will use this to log in initially."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <FormInput<CreateTeacherFormData>
                name="employee_code"
                label="Employee Code"
                placeholder="TCH-001"
                required
                description="Must be unique within the school."
              />
              <FormInput<CreateTeacherFormData>
                name="hire_date"
                label="Hire Date"
                required
                type="date"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                Assign classes and subjects
              </h3>
              <p className="text-sm text-muted-foreground">
                After the teacher is created, you can assign them to
                classes and subjects from the{" "}
                <a
                  href="/academic/assignments"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Teacher Assignments
                </a>{" "}
                page, or from their teacher profile.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <UserRound className="h-4 w-4 text-primary" />
                Summary — Personal Information
              </h3>
              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name: </span>
                  <span className="font-medium">
                    {getValues("first_name")} {getValues("last_name")}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  <span className="font-medium">
                    {getValues("phone") || (
                      <span className="italic text-muted-foreground">Not provided</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Qualification: </span>
                  <span className="font-medium">
                    {getValues("qualification") || (
                      <span className="italic text-muted-foreground">Not provided</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Specialization: </span>
                  <span className="font-medium">
                    {getValues("specialization") || (
                      <span className="italic text-muted-foreground">Not provided</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Summary — Account Information
              </h3>
              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <span className="font-medium">{getValues("email")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Employee Code: </span>
                  <span className="font-medium">{getValues("employee_code")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Hire Date: </span>
                  <span className="font-medium">{getValues("hire_date")}</span>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <AdminLayout>
      <ContentContainer className="max-w-2xl">
        <PageHeader
          title="Add Teacher"
          description="Create a new teacher account and profile."
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/users/teachers")}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>
        </PageHeader>

        {/* Step Indicator */}
        <div className="mt-8">{renderSteps()}</div>

        <FormProvider {...form}>
          {/* Step Content */}
          <Card>
            <CardContent className="pt-6">{renderStepContent()}</CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {currentStep < 3 ? (
              <Button onClick={handleNext} className="gap-2">
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="gap-2"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {createMutation.isPending
                  ? "Creating..."
                  : "Create Teacher"}
              </Button>
            )}
          </div>
        </FormProvider>
      </ContentContainer>
    </AdminLayout>
  );
}
