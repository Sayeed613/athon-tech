"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CalendarCheck,
  UserCheck,
  UserX,
  Clock,
  BadgePercent,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { attendanceService } from "@/services/attendance.service";
import { academicService } from "@/services/academic.service";

export default function StudentAttendancePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const { data: termsData } = useQuery({
    queryKey: queryKeys.academicTerms.list({ limit: 10 }),
    queryFn: () => academicService.listTerms(),
    staleTime: 60_000,
  });
  const terms = termsData?.academic_terms ?? [];
  const [selectedTermId, setSelectedTermId] = useState<string>("");

  // Auto-select first term
  useEffect(() => {
    if (!selectedTermId && terms.length > 0) {
      const current = terms.find((t) => t.is_current);
      setSelectedTermId(current?.id ?? terms[0].id);
    }
  }, [terms, selectedTermId]);

  const attendanceQuery = useQuery({
    queryKey: queryKeys.attendance.byStudent(studentId, selectedTermId),
    queryFn: () => attendanceService.getByStudent(studentId, { academic_term_id: selectedTermId }),
    enabled: !!studentId && !!selectedTermId,
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
    return {
      total, present, absent, late,
      presentPct: total > 0 ? Math.round((present / total) * 100) : 0,
      absentPct: total > 0 ? Math.round((absent / total) * 100) : 0,
      latePct: total > 0 ? Math.round((late / total) * 100) : 0,
    };
  }, [records]);

  const studentName = records[0]?.student
    ? `${records[0].student.first_name} ${records[0].student.last_name}`
    : "Student";
  const admissionNo = records[0]?.student?.admission_number ?? "";

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title={studentName}
          description={admissionNo ? `Admission No: ${admissionNo}` : "Student attendance records"}
        >
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </PageHeader>

        <div className="mt-4">
          <Select value={selectedTermId} onValueChange={(v: string | null) => v && setSelectedTermId(v)}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="Select term..." />
            </SelectTrigger>
            <SelectContent>
              {terms.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} {t.is_current ? "(Current)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                    <CalendarCheck className="h-4 w-4" /> Total Days
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BadgePercent className="h-4 w-4" /> Attendance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">{stats.presentPct}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats.present} days present</p>
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
                  <p className="text-xs text-muted-foreground mt-1">{stats.absent} days</p>
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
                  <p className="text-xs text-muted-foreground mt-1">{stats.late} days</p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-3">Attendance Records</h3>
              {records.length === 0 ? (
                <EmptyState variant="no-data" title="No records" description="No attendance records found for this term." />
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Marked By</th>
                        <th className="text-left p-3 font-medium">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr key={record.id} className="border-t hover:bg-muted/30 transition-colors">
                          <td className="p-3">{record.attendance_date}</td>
                          <td className="p-3">
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
                          </td>
                          <td className="p-3 text-muted-foreground">{record.marker?.name ?? "—"}</td>
                          <td className="p-3 text-muted-foreground">{record.remarks ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </ContentContainer>
    </AdminLayout>
  );
}
