"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  FileBarChart,
  ArrowLeft,
  Pencil,
  RefreshCw,
  AlertCircle,
  Calendar,
  Clock,
  UserRound,
  Building2,
  BookOpen,
  Trophy,
  Eye,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { testService } from "@/services/test.service";

export default function TestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const testId = params.id as string;

  const { data: test, isLoading, isError } = useQuery({
    queryKey: queryKeys.tests.detail(testId),
    queryFn: () => testService.get(testId),
    enabled: !!testId,
  });

  const resultsQuery = useQuery({
    queryKey: queryKeys.tests.results(testId),
    queryFn: () => testService.getResults(testId),
    enabled: !!testId,
  });

  const attempts = resultsQuery.data?.attempts ?? [];

  const stats = useMemo(() => {
    const scores = attempts.filter((a) => a.total_score != null).map((a) => a.total_score!);
    const graded = attempts.filter((a) => a.is_graded).length;
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const highest = scores.length > 0 ? Math.max(...scores) : 0;
    const lowest = scores.length > 0 ? Math.min(...scores) : 0;
    const passCount = test ? scores.filter((s) => s >= (test.total_marks * test.passing_percentage / 100)).length : 0;
    const passRate = scores.length > 0 ? Math.round((passCount / scores.length) * 100) : 0;
    return { total: attempts.length, graded, avg: Math.round(avg * 100) / 100, highest, lowest, passRate };
  }, [attempts, test]);

  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <Skeleton className="h-8 w-64" />
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  if (isError || !test) {
    return (
      <AdminLayout>
        <ContentContainer>
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-destructive">Test not found.</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/tests")}>Back to Tests</Button>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  const statusLabel = !test.is_published ? "Draft" : test.is_results_published ? "Results Published" : "Published";
  const statusVariant = !test.is_published ? "outline" : test.is_results_published ? "default" : "secondary" as const;

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title={test.title}
          description={`${test.test_type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} • ${test.class_?.name ?? "—"} • ${test.subject?.name ?? "—"}`}
        >
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/tests")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/tests/${testId}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/tests/${testId}/results`)}>
            <Trophy className="h-4 w-4" /> Results
          </Button>
        </PageHeader>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Trophy className="h-3 w-3" /> {test.total_marks} marks
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {test.duration_minutes} min
          </span>
          {test.scheduled_at && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {new Date(test.scheduled_at).toLocaleString()}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{stats.avg}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Highest</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.highest}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pass Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.passRate}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Info Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <UserRound className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Teacher</p>
                <p className="text-sm font-medium">{test.teacher?.name ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Class</p>
                <p className="text-sm font-medium">{test.class_?.name ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Subject</p>
                <p className="text-sm font-medium">{test.subject?.name ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Description */}
        {test.description && (
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{test.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Attempts */}
        <div className="mt-6">
          <Tabs defaultValue="attempts">
            <TabsList>
              <TabsTrigger value="attempts" className="gap-2">
                <Eye className="h-4 w-4" /> Attempts ({attempts.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="attempts" className="mt-4">
              {resultsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                </div>
              ) : attempts.length === 0 ? (
                <EmptyState variant="no-data" title="No attempts" description="No students have attempted this test yet." />
              ) : (
                <div className="space-y-2">
                  {attempts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {a.student?.first_name?.[0]}{a.student?.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{a.student?.first_name} {a.student?.last_name}</p>
                          <p className="text-xs text-muted-foreground">{a.student?.admission_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {a.is_graded ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {a.total_score}/{test.total_marks}
                          </Badge>
                        ) : a.status === "submitted" ? (
                          <Badge variant="secondary">Grading Needed</Badge>
                        ) : (
                          <Badge variant="outline" className="capitalize">{a.status.replace("_", " ")}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </ContentContainer>
    </AdminLayout>
  );
}
