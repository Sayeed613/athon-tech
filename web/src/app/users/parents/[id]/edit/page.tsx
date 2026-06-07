"use client";

import { use, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  Loader2,
  UserPlus,
  Search,
  Trash2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { parentService } from "@/services/parent.service";
import http from "@/lib/axios";
import type { Student } from "@/types/student";

// ── Validation Schema ─────────────────────────────────────────

const editParentSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  occupation: z.string().optional(),
});

type EditParentFormData = z.infer<typeof editParentSchema>;

const RELATIONSHIP_OPTIONS = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "guardian", label: "Guardian" },
  { value: "other", label: "Other" },
];

export default function EditParentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const showLinkPanel = searchParams.get("link") === "true";
  const [studentSearchOpen, setStudentSearchOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [unlinkTarget, setUnlinkTarget] = useState<{ id: string; student_name: string } | null>(null);
  const [linkRelationship, setLinkRelationship] = useState("father");
  const [linkPrimary, setLinkPrimary] = useState(true);
  const [linkWhatsapp, setLinkWhatsapp] = useState(true);

  // ── Fetch Parent ─────────────────────────────────────────────
  const { data: parent, isLoading, isError } = useQuery({
    queryKey: queryKeys.parents.detail(id),
    queryFn: () => parentService.get(id),
  });

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

  const linkedStudentIds = new Set(
    parent?.linked_students.map((ls) => ls.student_id) ?? []
  );
  const availableStudents = filteredStudents.filter(
    (s) => !linkedStudentIds.has(s.id)
  );

  // ── Form ─────────────────────────────────────────────────────
  const form = useForm<EditParentFormData>({
    resolver: zodResolver(editParentSchema),
    values: parent
      ? {
          first_name: parent.first_name,
          last_name: parent.last_name,
          phone: parent.phone ?? "",
          occupation: parent.occupation ?? "",
        }
      : undefined,
  });

  // ── Update Mutation ──────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data: EditParentFormData) =>
      parentService.update(id, {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || null,
        occupation: data.occupation || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parents.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.parents.all });
      toast({ title: "Parent updated" });
      router.push(`/users/parents/${id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  // ── Link Student Mutation ────────────────────────────────────
  const linkMutation = useMutation({
    mutationFn: (studentId: string) =>
      parentService.linkStudent({
        student_id: studentId,
        parent_id: id,
        relationship: linkRelationship,
        is_primary_contact: linkPrimary,
        receive_whatsapp: linkWhatsapp,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parents.detail(id) });
      toast({ title: "Student linked successfully" });
      setStudentSearchOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to link student", description: err.message, variant: "destructive" });
    },
  });

  // ── Unlink Student Mutation ──────────────────────────────────
  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) => parentService.unlinkStudent(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parents.detail(id) });
      toast({ title: "Student unlinked" });
      setUnlinkTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to unlink", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: EditParentFormData) => {
    updateMutation.mutate(data);
  };

  // ── Loading State ────────────────────────────────────────────
  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  if (isError || !parent) {
    return (
      <AdminLayout>
        <ContentContainer>
          <div className="flex flex-col items-center gap-4 py-20">
            <p className="text-destructive">Parent not found.</p>
            <Button variant="outline" onClick={() => router.push("/users/parents")}>Back to Parents</Button>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader title="Edit Parent" description="Update parent profile and manage student links.">
          <Button variant="ghost" className="gap-2" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input id="first_name" {...form.register("first_name")} />
                  {form.formState.errors.first_name && (
                    <p className="text-xs text-destructive">{form.formState.errors.first_name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input id="last_name" {...form.register("last_name")} />
                  {form.formState.errors.last_name && (
                    <p className="text-xs text-destructive">{form.formState.errors.last_name.message}</p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" {...form.register("phone")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input id="occupation" {...form.register("occupation")} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Linked Students Management */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Linked Students</CardTitle>
              <Popover open={studentSearchOpen} onOpenChange={setStudentSearchOpen}>
                <PopoverTrigger>
                  <Button variant="outline" size="sm" className="gap-2">
                    <UserPlus className="h-4 w-4" /> Link Student
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Search students..." onValueChange={setStudentSearch} />
                    <CommandList>
                      <CommandEmpty>{studentsLoading ? "Loading..." : "No students available."}</CommandEmpty>
                      <CommandGroup className="max-h-60 overflow-auto">
                        {availableStudents.map((student) => (
                          <CommandItem
                            key={student.id}
                            value={student.id}
                            onSelect={(value) => {
                              linkMutation.mutate(value);
                            }}
                          >
                            <div className="flex items-center gap-2 flex-1">
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
            </CardHeader>
            <CardContent>
              {parent.linked_students.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No students linked. Use the button above to link a student.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Link options for new links */}
                  {showLinkPanel && (
                    <div className="rounded-lg border p-4 space-y-3 mb-4">
                      <p className="text-sm font-medium">New Link Options</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Relationship</Label>
                          <Select value={linkRelationship} onValueChange={(v) => setLinkRelationship(v ?? "father")}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RELATIONSHIP_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end gap-4 pb-1">
                          <div className="flex items-center gap-2">
                            <Checkbox id="link_primary" checked={linkPrimary} onCheckedChange={(v) => setLinkPrimary(v === true)} />
                            <Label htmlFor="link_primary" className="cursor-pointer">Primary Contact</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox id="link_whatsapp" checked={linkWhatsapp} onCheckedChange={(v) => setLinkWhatsapp(v === true)} />
                            <Label htmlFor="link_whatsapp" className="cursor-pointer">WhatsApp</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Relationship</TableHead>
                        <TableHead>Primary</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parent.linked_students.map((ls) => (
                        <TableRow key={ls.id}>
                          <TableCell className="font-medium">{ls.student_name}</TableCell>
                          <TableCell>{ls.class_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{ls.relationship}</Badge>
                          </TableCell>
                          <TableCell>
                            {ls.is_primary_contact ? (
                              <Badge className="gap-1 bg-success/15 text-success hover:bg-success/20">
                                <CheckCircle2 className="h-3 w-3" /> Primary
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/users/students/${ls.student_id}`)}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setUnlinkTarget(ls)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>

        {/* Unlink Dialog */}
        <Dialog open={!!unlinkTarget} onOpenChange={(open) => !open && setUnlinkTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unlink Student</DialogTitle>
              <DialogDescription>
                Unlink <strong>{unlinkTarget?.student_name}</strong> from this parent?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUnlinkTarget(null)} disabled={unlinkMutation.isPending}>Cancel</Button>
              <Button variant="destructive" onClick={() => unlinkTarget && unlinkMutation.mutate(unlinkTarget.id)} disabled={unlinkMutation.isPending}>
                {unlinkMutation.isPending ? "Unlinking..." : "Unlink"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
