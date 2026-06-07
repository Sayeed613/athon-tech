"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { studentService } from "@/services/student.service";
import type { BulkImportResponse } from "@/types/student";

interface PreviewRow {
  row: number;
  email: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_id: string;
  valid: boolean;
  errors: string[];
}

export default function ImportStudentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResponse | null>(null);
  const [parsing, setParsing] = useState(false);

  // ── CSV Template ───────────────────────────────────────────
  const handleDownloadTemplate = useCallback(() => {
    const headers = "email,password,first_name,last_name,admission_number,class_id,roll_number,date_of_birth,gender";
    const example = "john.doe@school.edu,changeme123,John,Doe,STU-001,<class-uuid>,1,2010-01-15,male";
    const csv = [headers, example].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── CSV Parse ──────────────────────────────────────────────
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setImportResult(null);
    setParsing(true);

    try {
      const text = await file.text();
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());

      const requiredFields = ["email", "first_name", "last_name", "admission_number", "class_id"];
      const missingHeaders = requiredFields.filter((f) => !headers.includes(f));

      if (missingHeaders.length > 0) {
        toast({ title: "Invalid CSV format", description: `Missing columns: ${missingHeaders.join(", ")}`, variant: "destructive" });
        setParsing(false);
        return;
      }

      const rows: PreviewRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const rowData: Record<string, string> = {};
        headers.forEach((h, idx) => { rowData[h] = values[idx] ?? ""; });

        const errors: string[] = [];
        if (!rowData.email) errors.push("Email is required");
        if (!rowData.first_name) errors.push("First name is required");
        if (!rowData.last_name) errors.push("Last name is required");
        if (!rowData.admission_number) errors.push("Admission number is required");
        if (!rowData.class_id) errors.push("Class ID is required");

        rows.push({
          row: i,
          email: rowData.email || "",
          first_name: rowData.first_name || "",
          last_name: rowData.last_name || "",
          admission_number: rowData.admission_number || "",
          class_id: rowData.class_id || "",
          valid: errors.length === 0,
          errors,
        });
      }

      setPreviewRows(rows);
    } catch {
      toast({ title: "Failed to parse CSV", description: "The file could not be read. Check the format.", variant: "destructive" });
    }

    setParsing(false);
  }, [toast]);

  // ── Import Mutation ────────────────────────────────────────
  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = previewRows.filter((r) => r.valid);
      const payload = validRows.map((r) => ({
        email: r.email,
        password: "changeme123",
        first_name: r.first_name,
        last_name: r.last_name,
        admission_number: r.admission_number,
        class_id: r.class_id,
        roll_number: undefined,
        date_of_birth: undefined,
        gender: undefined,
      }));
      return studentService.bulkImport(payload);
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      if (result.imported > 0) {
        toast({ title: "Import complete", description: `${result.imported} students imported.`, variant: "success" });
      }
      if (result.failed > 0) {
        toast({ title: `${result.failed} records failed`, description: "Check the error details below.", variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const validCount = previewRows.filter((r) => r.valid).length;
  const invalidCount = previewRows.filter((r) => !r.valid).length;

  return (
    <AdminLayout>
      <ContentContainer className="max-w-3xl">
        <PageHeader title="Import Students" description="Bulk import student records from a CSV file.">
          <Button variant="outline" size="sm" onClick={() => router.push("/users/students")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
        </PageHeader>

        {/* Template Download */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" /> Step 1: Download Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Download the CSV template to see the required columns. The following fields are required:
              <span className="block mt-1 font-mono text-xs text-foreground">email, password, first_name, last_name, admission_number, class_id</span>
              Optional fields: <span className="font-mono text-xs">roll_number, date_of_birth, gender</span>
            </p>
            <Button variant="outline" className="gap-2" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4" /> Download Template
            </Button>
          </CardContent>
        </Card>

        {/* Upload */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" /> Step 2: Upload CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50 hover:bg-primary/5"
              onClick={() => fileInputRef.current?.click()}
            >
              {parsing ? (
                <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
              ) : (
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              )}
              <p className="text-sm font-medium">
                {csvFile ? csvFile.name : "Click to upload a CSV file"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Maximum 500 students per import
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {previewRows.length > 0 && !importResult && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Step 3: Review & Confirm
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {validCount} Valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" /> {invalidCount} Invalid
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">{previewRows.length} total rows</span>
              </div>

              {previewRows.slice(0, 10).map((row) => (
                <div key={row.row} className="flex items-center gap-3 rounded-md border px-3 py-2 mb-2 text-sm">
                  <div className={row.valid ? "text-success" : "text-destructive"}>
                    {row.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  </div>
                  <span className="text-muted-foreground w-6">#{row.row}</span>
                  <span className="flex-1 font-medium">{row.first_name} {row.last_name}</span>
                  <span className="text-muted-foreground">{row.email}</span>
                  {!row.valid && (
                    <span className="text-xs text-destructive">{row.errors.join("; ")}</span>
                  )}
                </div>
              ))}
              {previewRows.length > 10 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  +{previewRows.length - 10} more rows
                </p>
              )}

              <Separator className="my-4" />

              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => { setPreviewRows([]); setCsvFile(null); }}>
                  Clear
                </Button>
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={validCount === 0 || importMutation.isPending}
                  className="gap-2"
                >
                  {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {importMutation.isPending ? `Importing ${validCount} students...` : `Import ${validCount} Students`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Results */}
        {importResult && (
          <Card className="mt-6 border-success/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> Import Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span className="text-lg font-bold">{importResult.imported}</span>
                  <span className="text-sm text-muted-foreground">imported</span>
                </div>
                {importResult.failed > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="text-lg font-bold">{importResult.failed}</span>
                    <span className="text-sm text-muted-foreground">failed</span>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Error Details:</p>
                  {importResult.errors.slice(0, 20).map((err, i) => (
                    <div key={i} className="rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      Row #{err.row}: {err.email} — {err.error}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <Button variant="outline" onClick={() => router.push("/users/students")}>
                  View Students
                </Button>
                <Button variant="outline" onClick={() => { setPreviewRows([]); setCsvFile(null); setImportResult(null); }}>
                  Import Another File
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </ContentContainer>
    </AdminLayout>
  );
}
