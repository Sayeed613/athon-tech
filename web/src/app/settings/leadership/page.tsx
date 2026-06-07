"use client";

import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Crown } from "lucide-react";

export default function SchoolLeadershipPage() {
  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="School Leadership"
          description="Manage principal profiles and school leadership."
        />
        <div className="mt-12">
          <EmptyState
            variant="no-data"
            title="School Leadership"
            description="Leadership management coming soon. You'll be able to manage principal profiles here."
            icon={Crown}
          />
        </div>
      </ContentContainer>
    </AdminLayout>
  );
}
