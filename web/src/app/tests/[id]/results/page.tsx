"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  Trophy,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { queryKeys } from "@/lib/query-keys";
import { testService } from "@/services/test.service";

export default function TestResultsPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.id as string;

  const { data: test } = useQuery({
    queryKey: queryKeys.tests.detail(testId),
    queryFn: () => testService.get(testId),
    enabled: !!testId,
  });

  const { data: resultsData, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tests.results(testId),
    queryFn: () => testService.getResults(testId),
    enabled: !!testId,
  });

  const attempts = resultsData?.attempts ?? [];

  const stats = useMemo(() => {
    const scores = attempts.filter((a) => a.total_score != null).map((a) => a.total_score!);
    const graded = attempts.filter((a) => a.is_graded).length;
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const highest = scores.length > 0 ? Math.max(...scores) : 0;
    const lowest = scores.length > 0 ? Math.min(...scores) : 0;
    const passMark = test ? (test.total_marks * test.passing_percentage / 100) : 0;
    const passCount = scores.filter((s) => s >= passMark).length;
    const passRate = scores.length > 0 ? Math.round((passCount / scores.length) * 100) : 0;
    return {
      total: attempts.length, graded, avg: Math.round(avg * 100) / 100, highest, lowest,
      passCount, failCount: scores.length - passCount, passRate, passMark: Math.round(passMark),
    };
  }, [attempts, test]);

  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <Skeleton className="h-8 w-64" />
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <p className="flex-1 text-destructive">Failed to load results.</p>
            <Button variant="outline" size="sm" onClick={() => router.push(`/tests/${testId}`)}>Back to Test</Button>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="Test Results"
          description={`${test.title} • ${test.total_marks} marks • ${test.subject?.name ?? "—"}`}
        >
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/tests/${testId}`)}>
            <ArrowLeft className="h-4 w-4" /> Back to Test
          </Button>
        </PageHeader>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{stats.avg}</p>
              <p className="text-xs text-muted-foreground mt-1">out of {test.total_marks}</p>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Lowest</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">{stats.lowest}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pass Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.passRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">Pass mark: {stats.passMark}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Passed / Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-green-600">{stats.passCount}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-2xl font-bold text-red-600">{stats.failCount}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Graded</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.graded}</p>
              <p className="text-xs text-muted-foreground mt-1">of {stats.total}</p>
            </CardContent>
          </Card>
        </div>

        {/* Attempts Table */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3">Student Attempts</h3>
          {attempts.length === 0 ? (
            <EmptyState variant="no-data" title="No attempts" description="No students have attempted this test yet." />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-3 font-medium">Student</th>
                    <th className="text-left p-3 font-medium">Admission No</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Score</th>
                    <th className="text-left p-3 font-medium">Percentage</th>
                    <th className="text-left p-3 font-medium">Result</th>
                    <th className="text-left p-3 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => {
                    const pct = a.total_score != null && test.total_marks > 0
                      ? Math.round((a.total_score / test.total_marks) * 100)
                      : null;
                    const passed = pct != null && test
                      ? pct >= test.passing_percentage
                      : null;
                    return (
                      <tr key={a.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium">
                          {a.student?.first_name} {a.student?.last_name}
                        </td>
                        <td className="p-3 text-muted-foreground">{a.student?.admission_number ?? "—"}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {a.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {a.total_score != null ? `${a.total_score}/${test.total_marks}` : "—"}
                        </td>
                        <td className="p-3">
                          {pct != null ? (
                            <Badge variant={pct >= test.passing_percentage ? "default" : "destructive"}>
                              {pct}%
                            </Badge>
                          ) : "—"}
                        </td>
                        <td className="p-3">
                          {passed === true && (
                            <span className="flex items-center gap-1 text-green-600 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Pass
                            </span>
                          )}
                          {passed === false && (
                            <span className="flex items-center gap-1 text-red-600 text-xs">
                              <XCircle className="h-3.5 w-3.5" /> Fail
                            </span>
                          )}
                          {passed === null && <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ContentContainer>
    </AdminLayout>
  );
}
