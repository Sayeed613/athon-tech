/** Athon — Barrel Export for All Types */

export * from "./auth";
export * from "./api";

/** Common entity fields shared across all records */
export interface TimestampedEntity {
  id: string;
  created_at?: string;
  updated_at?: string;
}

export interface SoftDeletableEntity extends TimestampedEntity {
  deleted_at?: string | null;
}

export interface StatusEntity {
  is_active: boolean;
  status?: string;
}

/** Navigation item structure */
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  children?: NavItem[];
}

/** Breadcrumb segment */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}
