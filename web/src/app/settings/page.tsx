"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  AlertCircle,
  Save,
  Loader2,
  Building2,
  Globe,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { schoolService } from "@/services/school.service";
import { useAuthStore } from "@/hooks/use-auth-store";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const schoolId = useAuthStore((s) => s.schoolContext?.school_id);

  const { data: school, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.school.detail(schoolId ?? ""),
    queryFn: () => schoolService.get(schoolId!),
    enabled: !!schoolId,
    staleTime: 60_000,
  });

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    phone: "",
    email: "",
    website: "",
  });

  // Populate form when school data loads
  useEffect(() => {
    if (school) {
      setForm({
        name: school.name ?? "",
        address: school.address ?? "",
        city: school.city ?? "",
        state: school.state ?? "",
        zip_code: school.zip_code ?? "",
        phone: school.phone ?? "",
        email: school.email ?? "",
        website: school.website ?? "",
      });
    }
  }, [school]);

  const updateMutation = useMutation({
    mutationFn: () => schoolService.update(schoolId!, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.school.detail(schoolId ?? "") });
      toast({ title: "Saved", description: "School profile updated successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="School Settings"
          description="Manage your school profile and contact information."
        />

        {isLoading ? (
          <div className="mt-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive flex-1">Failed to load school profile.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : (
          <div className="mt-6 max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-5 w-5 text-primary" /> School Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>School Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="School name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Street address"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      value={form.state}
                      onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                      placeholder="State"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ZIP Code</Label>
                    <Input
                      value={form.zip_code}
                      onChange={(e) => setForm((p) => ({ ...p, zip_code: e.target.value }))}
                      placeholder="ZIP code"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-5 w-5 text-primary" /> Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="Email address"
                      type="email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    value={form.website}
                    onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                    placeholder="https://school.edu"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => school && setForm({
                  name: school.name ?? "",
                  address: school.address ?? "",
                  city: school.city ?? "",
                  state: school.state ?? "",
                  zip_code: school.zip_code ?? "",
                  phone: school.phone ?? "",
                  email: school.email ?? "",
                  website: school.website ?? "",
                })}
                disabled={updateMutation.isPending}
              >
                Reset
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !form.name.trim()}
                className="gap-2"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </ContentContainer>
    </AdminLayout>
  );
}
