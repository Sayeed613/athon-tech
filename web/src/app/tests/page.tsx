"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  FileBarChart,
  Plus,
  RefreshCw,
  AlertCircle,
  Eye,
  Pencil,
  Calendar,
  Users,
  Search,
  Download,
  Trophy,
  BookOpen,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useUserRole } from "@/hooks/use-auth";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryKeys } from "@/lib/query-keys";
import { testService } from "@/services/test.service";
import { classService } from "@/services/class.service";
import { toCSVRow } from "@/lib/utils";
import type { TestItem } from "@/types/test";

export default function TestsPage() {
  const router = useRouter();
  const role = useUserRole();
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [search, setSearch] = useState("");

  const isStudentView = role.isStudent;

  const { data: classesData } = useQuery({
    queryKey: queryKeys.classes.list({ limit: 200 }),
    queryFn: () => classService.list({ limit: 200 }),
    staleTime: 60_000,
    enabled: !isStudentView, // Students don't need class selector
  });
  const classes = classesData?.classes ?? [];

  const fallbackClassId = classes.length > 0 ? classes[0].id : "";
  useEffect(() => {
    if (selectedClassId === "all" && fallbackClassId && !isStudentView) {
      setSelectedClassId(fallbackClassId);
    }
  }, [selectedClassId, fallbackClassId, isStudentView]);

  // Students see their own tests via dedicated endpoint
  const studentTestsQuery = useQuery({
    queryKey: [...queryKeys.tests.all, "my-tests"],
    queryFn: () => testService.getMyTests(),
    enabled: isStudentView,
    staleTime: 30_000,
  });

  const testsQuery = useQuery({
    queryKey: queryKeys.tests.byClass(selectedClassId),
    queryFn: () => testService.getByClass(selectedClassId, {
      include_unpublished: role.isTeacher || role.isAdmin || role.isPrincipal
    }),
    enabled: selectedClassId !== "all" && !isStudentView,
    staleTime: 30_000,
  });

  const allTests = isStudentView
    ? (studentTestsQuery.data?.tests ?? [])
    : (testsQuery.data?.tests ?? []);
  const isLoading = isStudentView
    ? studentTestsQuery.isLoading
    : (selectedClassId !== "all" && testsQuery.isLoading);
  const isError = isStudentView
    ? studentTestsQuery.isError
    : (selectedClassId !== "all" && testsQuery.isError);

  const filtered = useMemo(() => {
    if (!search) return allTests;
    const q = search.toLowerCase();
    return allTests.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.subject?.name.toLowerCase().includes(q) ||
        t.teacher?.name.toLowerCase().includes(q)
    );
  }, [allTests, search]);

  const handleExportCSV = () => {
    const header = ["Title","Subject","Teacher","Class","Type","Marks","Duration","Scheduled","Status"];
    const rows = filtered.map((t) =>
      toCSVRow([t.title, t.subject?.name ?? "", t.teacher?.name ?? "", t.class_?.name ?? "", t.test_type, t.total_marks, `${t.duration_minutes}min`, t.scheduled_at ?? "", t.is_published ? "Published" : "Draft"])
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tests.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatus = (t: TestItem) => {
    if (!t.is_published) return { label: "Draft", variant: "outline" as const };
    if (t.is_results_published) return { label: "Results Published", variant: "default" as const };
    if (t.scheduled_at && new Date(t.scheduled_at) < new Date()) return { label: "Past", variant: "secondary" as const };
    return { label: "Published", variant: "default" as const };
  };

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title={isStudentView ? "My Tests" : "Tests"}
          description={isStudentView ? "View and attempt your tests." : "Create and manage tests and exams."}
        >
          {role.isTeacher && (
            <Button onClick={() => router.push("/tests/create")} size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New Test
            </Button>
          )}
        </PageHeader>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search tests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm shadow-sm"
            />
          </div>
          {!isStudentView && (
            <Select value={selectedClassId} onValueChange={(v: string | null) => v && setSelectedClassId(v)}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.section ? ` - ${c.section}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>

        {/* Summary */}
        {!isLoading && !isError && allTests.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <FileBarChart className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{allTests.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Trophy className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {allTests.filter((t) => t.is_results_published).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Results Published</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold text-amber-600">{allTests.filter((t) => !t.is_published).length}</p>
                  <p className="text-xs text-muted-foreground">Drafts</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading && (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        )}

        {isError && (
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-destructive">Failed to load tests.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => testsQuery.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}          {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState
            variant="no-data"
            title={isStudentView ? "No tests assigned" : "No tests"}
            description={search ? "No tests match your search." : isStudentView ? "You don't have any upcoming tests." : "No tests for this class yet."}
            action={role.isTeacher && !isStudentView ? { label: "Create Test", onClick: () => router.push("/tests/create") } : undefined}
          />
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <div className="mt-6 space-y-3">
            {filtered.map((test) => {
              const status = getStatus(test);
              return (
                <div
                  key={test.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => router.push(`/tests/${test.id}`)}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <FileBarChart className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{test.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{test.subject?.name ?? "—"}</Badge>
                        <span className="text-xs text-muted-foreground">{test.class_?.name ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{test.teacher?.name ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">{test.total_marks} marks</p>
                      <p className="text-xs text-muted-foreground">{test.duration_minutes} min</p>
                    </div>
                    <Badge variant={status.variant} className="capitalize">{status.label}</Badge>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); router.push(`/tests/${test.id}`); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {role.isTeacher && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); router.push(`/tests/${test.id}/edit`); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ContentContainer>
    </AdminLayout>
  );
}
