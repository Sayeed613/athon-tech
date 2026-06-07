/**
 * Athon — Application Configuration
 *
 * Central config derived from environment variables.
 * All runtime configuration lives here, never in components.
 */

export const config = {
  app: {
    name: "Athon",
    version: "0.1.0",
    env: (process.env.NEXT_PUBLIC_APP_ENV as string) ?? "development",
    debug: process.env.NEXT_PUBLIC_APP_DEBUG === "true",
  },

  api: {
    baseUrl: (process.env.NEXT_PUBLIC_API_URL as string) ?? "http://localhost:8000/api/v1",
    timeout: 30_000, // 30s
    retryCount: 3,
    retryDelay: 1_000, // 1s initial, exponential backoff
  },

  auth: {
    tokenKey: "athon_access_token",
    refreshThreshold: 5 * 60 * 1000, // 5 minutes before expiry
    sessionCheckInterval: 60 * 1000, // 1 minute
  },

  pagination: {
    defaultPageSize: 25,
    pageSizeOptions: [25, 50, 100] as const,
  },

  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedCsvTypes: ["text/csv", "application/vnd.ms-excel"],
  },

  cache: {
    staleTime: 30 * 1000, // 30s
    gcTime: 5 * 60 * 1000, // 5min
  },
} as const;

export type Config = typeof config;
