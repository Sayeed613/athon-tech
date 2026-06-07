"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Ban,
  CheckCircle2,
  ShieldAlert,
  UserRound,
  GraduationCap,
  Bell,
  Loader2,
  Trash2,
  UserPlus,
  ExternalLink,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { Parent, ParentLinkedStudent } from "@/types/parent";

export default function ParentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("profile");
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<ParentLinkedStudent | null>(null);

  // ── Fetch Parent Detail ──────────────────────────────────────
  const {
    data: parent,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.parents.detail(id),
    queryFn: () => parentService.get(id),
  });

  // ── Deactivation Mutation ────────────────────────────────────
  const deactivateMutation = useMutation({
    mutationFn: () => parentService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parents.all });
      toast({ title: "Parent deactivated" });
      setDeactivateOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to deactivate", description: err.message, variant: "destructive" });
    },
  });

  // ── Unlink Student Mutation ──────────────────────────────────
  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) => parentService.unlinkStudent(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parents.detail(id) });
      toast({ title: "Student unlinked", description: "The student has been unlinked from this parent." });
      setUnlinkTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to unlink", description: err.message, variant: "destructive" });
    },
  });

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

  // ── Error State ──────────────────────────────────────────────
  if (isError || !parent) {
    return (
      <AdminLayout>
        <ContentContainer>
          <div className="flex flex-col items-center gap-4 py-20">
            <p className="text-destructive">{error instanceof Error ? error.message : "Parent not found."}</p>
            <Button variant="outline" onClick={() => router.push("/users/parents")}>Back to Parents</Button>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  const initials = `${parent.first_name.charAt(0)}${parent.last_name.charAt(0)}`.toUpperCase();

  return (
    <AdminLayout>
      <ContentContainer>
        {/* Back Navigation */}
        <Button variant="ghost" className="mb-4 gap-2" onClick={() => router.push("/users/parents")}>
          <ArrowLeft className="h-4 w-4" /> Back to Parents
        </Button>

        {/* Profile Header */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-6 p-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">{parent.first_name} {parent.last_name}</h1>
                <Badge className={parent.is_active ? "bg-success/15 text-success" : ""} variant={parent.is_active ? "default" : "secondary"}>
                  {parent.is_active ? "Active" : "Inactive"}
                </Badge>
                {parent.is_verified && (
                  <Badge variant="outline" className="gap-1 text-success border-success/30">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{parent.email}</p>
              <p className="text-sm text-muted-foreground">{parent.phone || "No phone"}</p>
              {parent.occupation && (
                <p className="text-sm text-muted-foreground mt-1">{parent.occupation}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={() => router.push(`/users/parents/${id}/edit`)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => router.push(`/users/parents/${id}/edit?link=true`)}>
                <UserPlus className="h-4 w-4" /> Link Student
              </Button>
              {parent.is_active && (
                <Button variant="destructive" className="gap-2" onClick={() => setDeactivateOpen(true)}>
                  <Ban className="h-4 w-4" /> Deactivate
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <UserRound className="h-4 w-4" /> Profile
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-2">
              <GraduationCap className="h-4 w-4" /> Linked Students
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </TabsTrigger>
          </TabsList>

          {/* ── Profile Tab ────────────────────────────────── */}
          <TabsContent value="profile" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                  <p className="text-sm font-medium">{parent.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Phone</p>
                  <p className="text-sm font-medium">{parent.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Occupation</p>
                  <p className="text-sm font-medium">{parent.occupation || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                  <p className="text-sm font-medium">{parent.is_active ? "Active" : "Inactive"}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Linked Students Tab ────────────────────────── */}
          <TabsContent value="students" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Linked Students</CardTitle>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/users/parents/${id}/edit?link=true`)}>
                  <UserPlus className="h-4 w-4" /> Link Student
                </Button>
              </CardHeader>
              <CardContent>
                {parent.linked_students.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No students linked to this parent.</p>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/users/parents/${id}/edit?link=true`)}>
                      <UserPlus className="h-4 w-4" /> Link a Student
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Admission #</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Relationship</TableHead>
                        <TableHead>Primary Contact</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parent.linked_students.map((ls) => (
                        <TableRow key={ls.id}>
                          <TableCell className="font-medium">{ls.student_name}</TableCell>
                          <TableCell>{ls.admission_number}</TableCell>
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Notifications Tab ───────────────────────────── */}
          <TabsContent value="notifications" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Notification preferences can be managed per student link. Visit the student detail page to configure
                  WhatsApp and email notification settings for this parent.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Deactivate Dialog */}
        <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" /> Deactivate Parent
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to deactivate <strong>{parent.first_name} {parent.last_name}</strong>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeactivateOpen(false)} disabled={deactivateMutation.isPending}>Cancel</Button>
              <Button variant="destructive" onClick={() => deactivateMutation.mutate()} disabled={deactivateMutation.isPending}>
                {deactivateMutation.isPending ? "Deactivating..." : "Deactivate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unlink Dialog */}
        <Dialog open={!!unlinkTarget} onOpenChange={(open) => !open && setUnlinkTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" /> Unlink Student
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to unlink <strong>{unlinkTarget?.student_name}</strong> from this parent?
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
