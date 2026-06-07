"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Ban,
  CheckCircle2,
  Book,
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  Calendar,
  Hash,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { subjectService } from "@/services/subject.service";

export default function SubjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const subjectId = params?.id as string;

  const {
    data: subject,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.subjects.detail(subjectId),
    queryFn: () => subjectService.get(subjectId),
    enabled: !!subjectId,
  });

  const archiveMutation = useMutation({
    mutationFn: () => subjectService.archive(subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subjects.all });
      toast({ title: "Subject archived", description: "The subject has been archived." });
      setShowArchiveDialog(false);
    },
    onError: (err: Error) => {
      toast({ title: "Operation failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <Skeleton className="h-6 w-48" />
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2"><Skeleton className="h-48 w-full rounded-xl" /></div>
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  if (isError || !subject) {
    return (
      <AdminLayout>
        <ContentContainer>
          <PageHeader title="Subject not found" description="The subject could not be loaded." />
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Subject not found."}
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
      <ContentContainer>
        <Link href="/academic/subjects" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Subjects
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
              <Book className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{subject.name}</h1>
                <Badge variant="outline" className="text-[10px]">{subject.code}</Badge>
                <Badge className={subject.is_core ? "bg-primary/15 text-primary hover:bg-primary/20 gap-1" : "bg-secondary text-secondary-foreground gap-1"}>
                  {subject.is_core ? <><CheckCircle2 className="h-3 w-3" /> Core</> : "Elective"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Subject Code: {subject.code}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/academic/subjects/${subject.id}/edit`)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="destructive" size="sm" className="gap-2" onClick={() => setShowArchiveDialog(true)}>
              <Ban className="h-4 w-4" /> Archive
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Book className="h-4 w-4 text-primary" /> Subject Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Subject Name</p>
                    <p className="text-sm font-medium">{subject.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Subject Code</p>
                    <p className="text-sm font-medium">{subject.code}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="text-sm font-medium">
                      {subject.description ?? <span className="italic text-muted-foreground">No description provided</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="text-sm font-medium">{subject.is_core ? "Core Subject" : "Elective"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="h-4 w-4 text-primary" /> Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm">{subject.created_at ? format(new Date(subject.created_at), "MMM d, yyyy") : "—"}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="text-sm">{subject.updated_at ? format(new Date(subject.updated_at), "MMM d, yyyy") : "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => router.push(`/academic/subjects/${subject.id}/edit`)}>
                  <Pencil className="h-4 w-4" /> Edit Subject
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" /> Archive Subject
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to archive <strong>{subject.name}</strong>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowArchiveDialog(false)} disabled={archiveMutation.isPending}>Cancel</Button>
              <Button variant="destructive" onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending}>
                {archiveMutation.isPending ? "Archiving..." : "Archive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
