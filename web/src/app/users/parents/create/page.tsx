"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  UserRound,
  GraduationCap,
  FileText,
  Check,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Search,
  UserPlus,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { parentService } from "@/services/parent.service";
import http from "@/lib/axios";
import type { Student } from "@/types/student";

// ── Validation Schema ─────────────────────────────────────────

const createParentSchema = z.object({
  // Step 1: Personal Information
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
  occupation: z.string().optional(),

  // Step 2: Student Linking
  linked_student_id: z.string().optional(),
  relationship: z.string().optional(),
  is_primary_contact: z.boolean().default(false),
  receive_whatsapp: z.boolean().default(true),
});

type CreateParentFormData = z.infer<typeof createParentSchema>;

const RELATIONSHIP_OPTIONS = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "guardian", label: "Guardian" },
  { value: "other", label: "Other" },
];

// ── Steps ─────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Parent Information", icon: UserRound },
  { id: 2, label: "Student Linking", icon: GraduationCap },
  { id: 3, label: "Review & Confirm", icon: FileText },
];

export default function CreateParentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [studentSearchOpen, setStudentSearchOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  const form = useForm<CreateParentFormData>({
    resolver: zodResolver(createParentSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      phone: "",
      occupation: "",
      linked_student_id: "",
      relationship: "father",
      is_primary_contact: true,
      receive_whatsapp: true,
    },
  });

  const watchedFields = form.watch();

  // ── Fetch students for linking ───────────────────────────────
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: [...queryKeys.students.all, "all-for-linking"],
    queryFn: async () => {
      const { data } = await http.get<{ students: Student[] }>("/students", {
        params: { skip: 0, limit: 500, is_active: true },
      });
      return data.students;
    },
    staleTime: 60_000,
  });

  const students = studentsData ?? [];

  const filteredStudents = studentSearch
    ? students.filter(
        (s) =>
          `${s.first_name} ${s.last_name}`
            .toLowerCase()
            .includes(studentSearch.toLowerCase()) ||
          s.admission_number.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : students;

  const selectedStudent = students.find(
    (s) => s.id === watchedFields.linked_student_id
  );

  // ── Create Mutation ──────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: CreateParentFormData) => {
      // Create the parent
      const parent = await parentService.create({
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || null,
        occupation: data.occupation || null,
      });

      // Link student if provided
      if (data.linked_student_id && data.relationship) {
        await parentService.linkStudent({
          student_id: data.linked_student_id,
          parent_id: parent.id,
          relationship: data.relationship,
          is_primary_contact: data.is_primary_contact,
          receive_whatsapp: data.receive_whatsapp,
        });
      }

      return parent;
    },
    onSuccess: (parent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parents.all });
      toast({ title: "Parent created", description: "Parent account has been created successfully." });
      router.push(`/users/parents/${parent.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create parent", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CreateParentFormData) => {
    createMutation.mutate(data);
  };

  const goNext = async () => {
    if (currentStep === 1) {
      const valid = await form.trigger([
        "first_name",
        "last_name",
        "email",
        "password",
      ]);
      if (valid) setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const goBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // ── Render Step Indicator ────────────────────────────────────
  const renderSteps = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                  currentStep > step.id
                    ? "bg-primary text-primary-foreground"
                    : currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={`text-sm font-medium hidden sm:inline ${
                  currentStep >= step.id
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`mx-4 h-px w-16 sm:w-24 ${
                  currentStep > step.id ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Step 1: Parent Information ───────────────────────────────
  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <UserRound className="h-5 w-5" /> Parent Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name *</Label>
            <Input id="first_name" {...form.register("first_name")} placeholder="John" />
            {form.formState.errors.first_name && (
              <p className="text-xs text-destructive">{form.formState.errors.first_name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name *</Label>
            <Input id="last_name" {...form.register("last_name")} placeholder="Doe" />
            {form.formState.errors.last_name && (
              <p className="text-xs text-destructive">{form.formState.errors.last_name.message}</p>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" {...form.register("email")} placeholder="parent@school.com" />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Temporary Password *</Label>
            <Input id="password" type="password" {...form.register("password")} placeholder="Min 6 characters" />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" {...form.register("phone")} placeholder="+1 234 567 890" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input id="occupation" {...form.register("occupation")} placeholder="Engineer, Teacher, etc." />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ── Step 2: Student Linking ──────────────────────────────────
  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <GraduationCap className="h-5 w-5" /> Link to Student
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Select Student (optional)</Label>
          <Popover open={studentSearchOpen} onOpenChange={setStudentSearchOpen}>              <PopoverTrigger>
              <Button variant="outline" role="combobox" aria-expanded={studentSearchOpen} className="w-full justify-between">
                {selectedStudent
                  ? `${selectedStudent.first_name} ${selectedStudent.last_name} (${selectedStudent.admission_number})`
                  : "Search for a student..."}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search by name or admission #..." onValueChange={setStudentSearch} />
                <CommandList>
                  <CommandEmpty>{studentsLoading ? "Loading..." : "No students found."}</CommandEmpty>
                  <CommandGroup className="max-h-60 overflow-auto">
                    {filteredStudents.map((student) => (
                      <CommandItem
                        key={student.id}
                        value={student.id}
                        onSelect={(value) => {
                          form.setValue("linked_student_id", value);
                          setStudentSearchOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm">{student.first_name} {student.last_name}</p>
                            <p className="text-xs text-muted-foreground">{student.admission_number} — {student.class_name}</p>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {selectedStudent && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship *</Label>
                <Select
                  value={form.watch("relationship")}
                  onValueChange={(v) => form.setValue("relationship", v ?? "father")}
                >
                  <SelectTrigger id="relationship">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_primary_contact"
                    checked={form.watch("is_primary_contact")}
                    onCheckedChange={(v) => form.setValue("is_primary_contact", v === true)}
                  />
                  <Label htmlFor="is_primary_contact" className="cursor-pointer">Primary Contact</Label>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="receive_whatsapp"
                checked={form.watch("receive_whatsapp")}
                onCheckedChange={(v) => form.setValue("receive_whatsapp", v === true)}
              />
              <Label htmlFor="receive_whatsapp" className="cursor-pointer">Receive WhatsApp messages</Label>
            </div>
          </>
        )}

        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs text-muted-foreground">
            You can link additional students later from the parent's profile page.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  // ── Step 3: Review & Confirm ─────────────────────────────────
  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" /> Review & Confirm
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Personal Info Summary */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Parent Information</h3>
          <div className="grid gap-2 sm:grid-cols-2 rounded-lg bg-muted p-4">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="text-sm font-medium">{watchedFields.first_name} {watchedFields.last_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{watchedFields.email}</p>
            </div>
            {watchedFields.phone && (
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{watchedFields.phone}</p>
              </div>
            )}
            {watchedFields.occupation && (
              <div>
                <p className="text-xs text-muted-foreground">Occupation</p>
                <p className="text-sm font-medium">{watchedFields.occupation}</p>
              </div>
            )}
          </div>
        </div>

        {/* Student Link Summary */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Student Linking</h3>
          <div className="rounded-lg bg-muted p-4">
            {selectedStudent ? (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {selectedStudent.first_name.charAt(0)}{selectedStudent.last_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedStudent.admission_number} — {selectedStudent.class_name}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="capitalize text-xs">{watchedFields.relationship}</Badge>
                    {watchedFields.is_primary_contact && (
                      <Badge variant="secondary" className="text-xs">Primary Contact</Badge>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No student linked. Can be linked later from the parent's profile.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="Add Parent"
          description="Create a new parent or guardian account."
        >
          <Button variant="ghost" className="gap-2" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          {renderSteps()}

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

          {/* Navigation Buttons */}
          <div className="mt-6 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>

            {currentStep < 3 ? (
              <Button type="button" onClick={goNext} className="gap-2">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {createMutation.isPending ? "Creating..." : "Create Parent"}
              </Button>
            )}
          </div>
        </form>
      </ContentContainer>
    </AdminLayout>
  );
}
