"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CalendarCheck,
  Users,
  UserCheck,
  UserX,
  Clock,
  Download,
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
import { attendanceService } from "@/services/attendance.service";
import { classService } from "@/services/class.service";
import { cn } from "@/lib/utils";

export default function ClassAttendancePage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [date, setDate] = useState(today);

  const { data: classData } = useQuery({
    queryKey: queryKeys.classes.detail(classId),
    queryFn: () => classService.get(classId),
    enabled: !!classId,
  });

  const attendanceQuery = useQuery({
    queryKey: queryKeys.attendance.byClass(classId, { date }),
    queryFn: () => attendanceService.getByClass(classId, { date }),
    enabled: !!classId,
    staleTime: 15_000,
  });

  const records = attendanceQuery.data?.records ?? [];
  const isLoading = attendanceQuery.isLoading;
  const isError = attendanceQuery.isError;

  const stats = useMemo(() => {
    const total = records.length;
    const present = records.filter((r) => r.status === "present").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const late = records.filter((r) => r.status === "late").length;
    const halfDay = records.filter((r) => r.status === "half_day").length;
    return {
      total, present, absent, late, halfDay,
      presentPct: total > 0 ? Math.round((present / total) * 100) : 0,
      absentPct: total > 0 ? Math.round((absent / total) * 100) : 0,
      latePct: total > 0 ? Math.round((late / total) * 100) : 0,
    };
  }, [records]);

  const handleExportCSV = () => {
    const header = "Student,Admission No,Status,Remarks";
    const rows = records.map((r) =>
      `${r.student?.first_name} ${r.student?.last_name},${r.student?.admission_number},${r.status},${r.remarks ?? ""}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${classData?.name ?? classId}-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title={classData ? `${classData.name}${classData.section ? ` - ${classData.section}` : ""}` : "Class Attendance"}
          description={`Attendance records for ${date}`}
        >
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/attendance")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV} disabled={records.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-destructive">Failed to load attendance.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => attendanceQuery.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" /> Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-green-600" /> Present
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">{stats.presentPct}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats.present} students</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <UserX className="h-4 w-4 text-red-600" /> Absent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-red-600">{stats.absentPct}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats.absent} students</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" /> Late
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-amber-600">{stats.latePct}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats.late} students</p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-3">Records</h3>
              {records.length === 0 ? (
                <EmptyState
                  variant="no-data"
                  title="No records"
                  description={`No attendance records for ${date}.`}
                />
              ) : (
                <div className="space-y-2">
                  {records.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/attendance/student/${record.student_id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {record.student?.first_name?.[0]}{record.student?.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {record.student?.first_name} {record.student?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{record.student?.admission_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.remarks && (
                          <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {record.remarks}
                          </span>
                        )}
                        <Badge
                          variant={
                            record.status === "present" ? "default" :
                            record.status === "absent" ? "destructive" :
                            record.status === "late" ? "secondary" : "outline"
                          }
                          className="capitalize"
                        >
                          {record.status === "half_day" ? "Half Day" : record.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </ContentContainer>
    </AdminLayout>
  );
}
