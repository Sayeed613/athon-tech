"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw,
  AlertCircle,
  CalendarCheck,
  BookOpen,
  FileText,
  Users,
  BarChart3,
  Download,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryKeys } from "@/lib/query-keys";
import { reportService } from "@/services/reports.service";
import { classService } from "@/services/class.service";
import { cn } from "@/lib/utils";

const formatPct = (n: number) => `${Math.round(n)}%`;

export default function ReportsPage() {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [activeTab, setActiveTab] = useState("attendance");
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  const { data: classesData } = useQuery({
    queryKey: queryKeys.classes.list({ limit: 200 }),
    queryFn: () => classService.list({ limit: 200 }),
    staleTime: 60_000,
  });
  const classes = classesData?.classes ?? [];

  const classParam = selectedClassId !== "all" ? selectedClassId : undefined;

  // Attendance Report
  const attendanceQuery = useQuery({
    queryKey: queryKeys.reports.attendance({ class_id: classParam, start_date: startDate, end_date: endDate }),
    queryFn: () => reportService.getAttendance({ class_id: classParam, start_date: startDate, end_date: endDate }),
    staleTime: 30_000,
  });

  // Homework Report
  const homeworkQuery = useQuery({
    queryKey: queryKeys.reports.homework({ class_id: classParam, start_date: startDate, end_date: endDate }),
    queryFn: () => reportService.getHomework({ class_id: classParam, start_date: startDate, end_date: endDate }),
    staleTime: 30_000,
  });

  // Tests Report
  const testsQuery = useQuery({
    queryKey: queryKeys.reports.tests({ class_id: classParam, start_date: startDate, end_date: endDate }),
    queryFn: () => reportService.getTests({ class_id: classParam, start_date: startDate, end_date: endDate }),
    staleTime: 30_000,
  });

  const activeQuery = activeTab === "attendance" ? attendanceQuery : activeTab === "homework" ? homeworkQuery : testsQuery;
  const isLoading = activeQuery.isLoading;
  const isError = activeQuery.isError;

  const attData = attendanceQuery.data;
  const hwData = homeworkQuery.data;
  const testData = testsQuery.data;

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="Reports"
          description="School performance analytics across attendance, homework, and tests."
        >
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              attendanceQuery.refetch();
              homeworkQuery.refetch();
              testsQuery.refetch();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh All
          </Button>
        </PageHeader>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Class</label>
            <Select value={selectedClassId} onValueChange={(v: string | null) => v && setSelectedClassId(v)}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.section ? ` - ${c.section}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const csv = activeTab === "attendance"
                ? exportAttendanceCSV(attData)
                : activeTab === "homework"
                ? exportHomeworkCSV(hwData)
                : exportTestsCSV(testData);
              if (!csv) return;
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${activeTab}-report.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={!attData && !hwData && !testData}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>

        {/* Tabs */}
        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="attendance" className="gap-2">
                <CalendarCheck className="h-4 w-4" /> Attendance
              </TabsTrigger>
              <TabsTrigger value="homework" className="gap-2">
                <BookOpen className="h-4 w-4" /> Homework
              </TabsTrigger>
              <TabsTrigger value="tests" className="gap-2">
                <FileText className="h-4 w-4" /> Tests
              </TabsTrigger>
            </TabsList>

            {/* ── Attendance Tab ──────────────────────────────── */}
            <TabsContent value="attendance" className="mt-6">
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
              ) : isError ? (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">Failed to load attendance report.</p>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => attendanceQuery.refetch()}>
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </Button>
                </div>
              ) : !attData || attData.total_records === 0 ? (
                <EmptyState variant="no-data" title="No data" description="No attendance records for the selected period." icon={CalendarCheck} />
              ) : (
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle></CardHeader>
                      <CardContent><p className="text-3xl font-bold">{attData.total_records}</p></CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Present</CardTitle></CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-green-600">{formatPct(attData.present_percentage)}</p>
                        <p className="text-xs text-muted-foreground">{attData.present_count} students</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Absent</CardTitle></CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-red-600">{formatPct(attData.absent_percentage)}</p>
                        <p className="text-xs text-muted-foreground">{attData.absent_count} students</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Average</CardTitle></CardHeader>
                      <CardContent>
                        <p className={cn("text-3xl font-bold", attData.average_percentage >= 90 ? "text-green-600" : attData.average_percentage >= 75 ? "text-amber-600" : "text-red-600")}>
                          {formatPct(attData.average_percentage)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Class Breakdown */}
                  {attData.class_breakdown.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" /> Class Breakdown
                      </h3>
                      <div className="space-y-2">
                        {attData.class_breakdown.map((cls) => (
                          <div key={cls.class_id} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{cls.class_name}</p>
                                <p className="text-xs text-muted-foreground">{cls.student_count} students · {cls.total_records} records</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${cls.present_percentage}%` }} />
                                </div>
                                <span className={cn("text-sm font-semibold min-w-[3rem] text-right", cls.present_percentage >= 90 ? "text-green-600" : "text-amber-600")}>
                                  {formatPct(cls.present_percentage)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Homework Tab ────────────────────────────────── */}
            <TabsContent value="homework" className="mt-6">
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
              ) : isError ? (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">Failed to load homework report.</p>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => homeworkQuery.refetch()}>
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </Button>
                </div>
              ) : !hwData || hwData.total_assigned === 0 ? (
                <EmptyState variant="no-data" title="No data" description="No homework assignments for the selected period." icon={BookOpen} />
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Assigned</CardTitle></CardHeader>
                      <CardContent><p className="text-3xl font-bold">{hwData.total_assigned}</p></CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Submissions</CardTitle></CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-blue-600">{hwData.total_submissions}</p>
                        <p className="text-xs text-muted-foreground">{formatPct(hwData.submission_rate)} rate</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Graded</CardTitle></CardHeader>
                      <CardContent><p className="text-3xl font-bold">{hwData.total_graded} <span className="text-sm text-muted-foreground">/ {hwData.total_submissions}</span></p></CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg Score</CardTitle></CardHeader>
                      <CardContent>
                        <p className={cn("text-3xl font-bold", (hwData.average_score ?? 0) >= 75 ? "text-green-600" : (hwData.average_score ?? 0) >= 50 ? "text-amber-600" : "text-red-600")}>
                          {(hwData.average_score ?? 0).toFixed(1)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {hwData.class_breakdown.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" /> Class Breakdown
                      </h3>
                      <div className="space-y-2">
                        {hwData.class_breakdown.map((cls) => (
                          <div key={cls.class_id} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                <BookOpen className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{cls.class_name}</p>
                                <p className="text-xs text-muted-foreground">{cls.assigned} assignments</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <div className="text-right">
                                <p className="font-medium">{formatPct(cls.submission_rate)}</p>
                                <p className="text-xs text-muted-foreground">submission</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{(cls.average_score ?? 0).toFixed(1)}</p>
                                <p className="text-xs text-muted-foreground">avg score</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Tests Tab ───────────────────────────────────── */}
            <TabsContent value="tests" className="mt-6">
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
              ) : isError ? (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">Failed to load test report.</p>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => testsQuery.refetch()}>
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </Button>
                </div>
              ) : !testData || testData.total_tests === 0 ? (
                <EmptyState variant="no-data" title="No data" description="No tests for the selected period." icon={FileText} />
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Tests</CardTitle></CardHeader>
                      <CardContent><p className="text-3xl font-bold">{testData.total_tests}</p></CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Attempts</CardTitle></CardHeader>
                      <CardContent><p className="text-3xl font-bold">{testData.total_attempts}</p></CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg Score</CardTitle></CardHeader>
                      <CardContent>
                        <p className={cn("text-3xl font-bold", (testData.average_score ?? 0) >= 75 ? "text-green-600" : (testData.average_score ?? 0) >= 50 ? "text-amber-600" : "text-red-600")}>
                          {(testData.average_score ?? 0).toFixed(1)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pass Rate</CardTitle></CardHeader>
                      <CardContent>
                        <p className={cn("text-3xl font-bold", (testData.pass_rate ?? 0) >= 80 ? "text-green-600" : (testData.pass_rate ?? 0) >= 60 ? "text-amber-600" : "text-red-600")}>
                          {formatPct(testData.pass_rate ?? 0)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {testData.class_breakdown.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" /> Class Breakdown
                      </h3>
                      <div className="space-y-2">
                        {testData.class_breakdown.map((cls) => (
                          <div key={cls.class_id} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                <FileText className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{cls.class_name}</p>
                                <p className="text-xs text-muted-foreground">{cls.tests_count} tests</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <div className="text-right">
                                <p className="font-medium">{(cls.average_score ?? 0).toFixed(1)}</p>
                                <p className="text-xs text-muted-foreground">avg score</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{formatPct(cls.pass_rate ?? 0)}</p>
                                <p className="text-xs text-muted-foreground">pass rate</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </ContentContainer>
    </AdminLayout>
  );
}

// ── CSV Export Helpers ──────────────────────────────────────────

function exportAttendanceCSV(data?: {
  total_records: number;
  present_percentage: number;
  absent_percentage: number;
  average_percentage: number;
  class_breakdown: { class_name: string; present_percentage: number; total_records: number; student_count: number }[];
}): string | null {
  if (!data) return null;
  const lines = ["Report,Value"];
  lines.push(`Total Records,${data.total_records}`);
  lines.push(`Present %,${(data.present_percentage ?? 0).toFixed(1)}`);
  lines.push(`Absent %,${(data.absent_percentage ?? 0).toFixed(1)}`);
  lines.push(`Average %,${(data.average_percentage ?? 0).toFixed(1)}`);
  lines.push("");
  lines.push("Class,Students,Records,Present %");
  for (const cls of data.class_breakdown) {
    lines.push(`${cls.class_name},${cls.student_count},${cls.total_records},${(cls.present_percentage ?? 0).toFixed(1)}`);
  }
  return lines.join("\n");
}

function exportHomeworkCSV(data?: {
  total_assigned: number;
  total_submissions: number;
  submission_rate: number;
  average_score: number;
  class_breakdown: { class_name: string; assigned: number; submission_rate: number; average_score: number }[];
}): string | null {
  if (!data) return null;
  const lines = ["Report,Value"];
  lines.push(`Total Assigned,${data.total_assigned}`);
  lines.push(`Total Submissions,${data.total_submissions}`);
  lines.push(`Submission Rate,${(data.submission_rate ?? 0).toFixed(1)}%`);
  lines.push(`Average Score,${(data.average_score ?? 0).toFixed(1)}`);
  lines.push("");
  lines.push("Class,Assigned,Submission %,Avg Score");
  for (const cls of data.class_breakdown) {
    lines.push(`${cls.class_name},${cls.assigned},${(cls.submission_rate ?? 0).toFixed(1)},${(cls.average_score ?? 0).toFixed(1)}`);
  }
  return lines.join("\n");
}

function exportTestsCSV(data?: {
  total_tests: number;
  total_attempts: number;
  average_score: number;
  pass_rate: number;
  class_breakdown: { class_name: string; tests_count: number; average_score: number; pass_rate: number }[];
}): string | null {
  if (!data) return null;
  const lines = ["Report,Value"];
  lines.push(`Total Tests,${data.total_tests}`);
  lines.push(`Total Attempts,${data.total_attempts}`);
  lines.push(`Average Score,${(data.average_score ?? 0).toFixed(1)}`);
  lines.push(`Pass Rate,${(data.pass_rate ?? 0).toFixed(1)}%`);
  lines.push("");
  lines.push("Class,Tests,Avg Score,Pass Rate");
  for (const cls of data.class_breakdown) {
    lines.push(`${cls.class_name},${cls.tests_count},${(cls.average_score ?? 0).toFixed(1)},${(cls.pass_rate ?? 0).toFixed(1)}`);
  }
  return lines.join("\n");
}
