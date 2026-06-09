# 🏫 Athon — Frontend Phase F1 Foundation Blueprint

> **Version**: 1.0  
> **Status**: ✅ **Build Verified — 0 Errors**  
> **Stack**: Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (base-nova)  
> **Date**: June 4, 2026  

---

## A. Frontend Foundation Blueprint

### What Was Built

Phase F1 establishes the complete frontend foundation for the Athon Web application. No business screens are included — only the shared infrastructure that every feature module depends on.

| Layer | Status | Files |
|-------|--------|-------|
| Project scaffolding | ✅ | `package.json`, `tsconfig.json`, `next.config.ts` |
| Folder structure | ✅ | 48 directories across `components/`, `features/`, `services/`, `hooks/` |
| Theme system | ✅ | `globals.css` with Athon design tokens, light/dark mode |
| UI component library | ✅ | 27 shadcn/ui components installed |
| Layout system | ✅ | Sidebar, TopNav, Breadcrumbs, AdminLayout, AuthGuard |
| Auth system | ✅ | Login page, JWT storage, session validation, role-based guards |
| API layer | ✅ | Axios client, interceptors, BaseService, query key factory |
| State management | ✅ | Zustand stores (auth, theme, UI) |
| Form system | ✅ | `useZodForm`, form fields, form actions |
| Data table | ✅ | Sorting, filtering, search, pagination, bulk, export, column visibility |
| Error handling | ✅ | ErrorBoundary, ErrorFallback, offline detection, toast system |
| Security | ✅ | AuthGuard, ROLE_ROUTES, 401 auto-logout |

### File Count

```
web/src/
├── app/           (6 files — layout, pages)
├── components/    (32 files — layout, shared, forms, tables, ui)
├── hooks/         (6 files — stores, auth, form, online)
├── providers/     (4 files — app, query, theme)
├── services/      (2 files — auth, base)
├── types/         (3 files — auth, api, index)
├── lib/           (3 files — axios, utils, query-keys)
├── constants/     (1 file — nav, routes, roles, endpoints)
├── config/        (1 file — environment config)
└── styles/        (empty — globals.css covers this)
```

---

## B. Folder Structure

```
web/src/
├── app/                          ← Next.js App Router pages
│   ├── (auth)/login/             ← Login page (unauthenticated)
│   ├── dashboard/                ← Dashboard page (authenticated)
│   ├── users/{teachers,students,parents,principals}/  ← Feature route groups
│   ├── academic/{classes,subjects,years,terms,periods,assignments}/
│   ├── timetable/
│   ├── announcements/
│   ├── notifications/
│   ├── reports/
│   ├── settings/
│   ├── layout.tsx                ← Root layout (fonts, providers)
│   ├── page.tsx                  ← Redirects to /dashboard
│   └── globals.css               ← Design tokens, Tailwind v4
│
├── components/
│   ├── ui/                       ← shadcn/ui components (27 files)
│   ├── layout/                   ← Sidebar, TopNav, Breadcrumbs, AdminLayout
│   ├── shared/                   ← AuthGuard, ErrorBoundary, OfflineBanner
│   ├── forms/                    ← FormFields, FormActions
│   ├── tables/                   ← DataTable (TanStack Table)
│   └── charts/                   ← (empty — reserved for Recharts)
│
├── features/                     ← Domain logic per feature module
│   ├── auth/                     ← Auth feature
│   ├── dashboard/                ← Dashboard feature
│   ├── users/{teachers,students,parents,principals}/
│   ├── academic/{classes,subjects,years,terms,periods,assignments}/
│   ├── timetable/
│   ├── announcements/
│   ├── notifications/
│   ├── reports/
│   └── settings/
│
├── services/                     ← API service layer
│   ├── auth.service.ts           ← Login, Me, Context
│   └── base.service.ts           ← Generic CRUD service factory
│
├── hooks/                        ← State management + custom hooks
│   ├── use-auth-store.ts         ← Zustand persisted auth store
│   ├── use-theme-store.ts        ← Zustand persisted theme store
│   ├── use-ui-store.ts           ← Zustand UI state store
│   ├── use-auth.ts               ← Auth hooks (login, logout, role checks)
│   ├── use-zod-form.ts           ← React Hook Form + Zod integration
│   └── use-online-status.ts      ← Offline detection
│
├── types/                        ← TypeScript type definitions
│   ├── auth.ts                   ← LoginRequest/Response, UserProfile, AuthState
│   ├── api.ts                    ← PaginatedResponse, ApiError, RequestParams
│   └── index.ts                  ← Shared entity types, NavItem, BreadcrumbItem
│
├── lib/                          ← Utilities
│   ├── axios.ts                  ← Axios instance with auth interceptors
│   ├── utils.ts                  ← cn() helper (clsx + tailwind-merge)
│   └── query-keys.ts             ← TanStack Query key factory
│
├── constants/                    ← App-wide constants
│   └── index.ts                  ← Nav items, roles, route permissions, API endpoints
│
├── providers/                    ← React context providers
│   ├── app-provider.tsx          ← Root provider composition
│   ├── query-provider.tsx        ← TanStack Query provider
│   └── theme-provider.tsx        ← Theme provider
│
├── config/                       ← Environment configuration
│   └── index.ts                  ← API URL, auth settings, pagination defaults
│
└── styles/                       ← (reserved)
```

---

## C. Architecture Decisions

### C.1 Authentication Flow

```
User → Login Form → POST /auth/login (Supabase Auth)
                   → Response: { access_token, user }
                   → Store token in Zustand (persisted to localStorage)
                   → Store user profile in Zustand
                   → Redirect to /dashboard

On App Mount (any page):
                   → Check localStorage for persisted token
                   → GET /auth/me (validate token)
                   → GET /auth/context (get school context)
                   → If valid: render protected content
                   → If invalid (401): clear token, redirect to /login
```

**Decision**: Zustand with `persist` middleware over `useContext` + `useReducer`.
**Rationale**: Zustand provides simpler persistence, no provider nesting, and the `persist` middleware gives automatic localStorage sync without manual serialization.

### C.2 API Layer Design

```
Component → TanStack Query Hook → BaseService → Axios Instance → Backend
                                        ↑
                                  Request Interceptor
                                  (attaches Bearer token)
                                  Response Interceptor
                                  (handles 401 → logout)
```

**Decision**: Axios over fetch or ky.
**Rationale**: Axios has mature interceptor patterns, request cancellation, and automatic JSON parsing. The interceptor injection pattern (`injectAuthStore`) breaks the circular dependency between Axios and the Zustand store.

### C.3 State Management Strategy

| Store | Scope | Persisted? | Why |
|-------|-------|:----------:|-----|
| `useAuthStore` | Auth tokens, user profile, school context | ✅ | Survive page refresh |
| `useThemeStore` | Theme preference | ✅ | Survive page refresh |
| `useUIStore` | Sidebar state, loading flags | ❌ | Session-only |

**Decision**: No global store for server data. TanStack Query handles all data fetching with its own cache.
**Rationale**: Server state (teachers list, students, etc.) belongs in TanStack Query cache, not in a global store. Zustand stores are reserved for client-only state (auth, theme, UI).

### C.4 Route Protection Strategy

```
Request → AuthGuard (client component)
         → Check PUBLIC_ROUTES → allow
         → Check isAuthenticated → redirect to /login
         → Check ROUTE_ROLES[pathname] → contains user.role?
           → Yes: render
           → No: redirect to /dashboard
```

**Decision**: Client-side guard embedded in layout over Next.js Middleware.
**Rationale**: Middleware has limited access to client-side stores (token in localStorage). The client-side `AuthGuard` in `AdminLayout` can read Zustand state directly. For a web app that's always loaded via client navigation, this is sufficient.

### C.5 Form Architecture

```
Schema (Zod) → useZodForm → react-hook-form → FormProvider → FormFields
                                                         ↘ FormActions
```

**Decision**: React Hook Form + Zod via `useZodForm` hook.
**Rationale**: Standard pattern in the React ecosystem. React Hook Form avoids uncontrolled-to-controlled warnings, Zod provides type inference and validation. The hook is a thin wrapper that reduces boilerplate.

### C.6 Table Architecture

```
TanStack Table v8 → DataTable component
                   → Sorting (column header click)
                   → Filtering (column filters)
                   → Search (global search bar)
                   → Pagination (25/50/100 per page)
                   → Bulk selection (checkbox + action bar)
                   → Export (CSV download)
                   → Column visibility (dropdown toggle)
                   → Loading skeleton
```

**Decision**: TanStack Table v8 over custom table or AG Grid.
**Rationale**: TanStack Table is headless (no UI constraints), has first-class TypeScript support, and works perfectly with Tailwind/shadcn styling. AG Grid is too opinionated for a shadcn-based design system.

### C.7 Theme System

**Decision**: CSS custom properties over Tailwind CSS variables.
**Rationale**: Tailwind v4 uses `@theme inline` for design tokens, which maps CSS variables to Tailwind utility classes. The Athon color palette is defined as CSS custom properties in `:root` and `.dark`, then mapped via `@theme inline` to enable `bg-primary`, `text-muted-foreground`, etc.

### C.8 Error Handling Strategy

```
Error Type              Detection              UX Response
───────────             ──────────              ───────────
Validation              Zod schema              Inline field error (FormMessage)
Authorization (401)     Axios interceptor       Auto-logout + redirect to /login
Permission denied (403) Backend response        Toast + redirect to /dashboard
Network failure         Axios timeout           OfflineBanner + retry button
Server error (500)      Axios response          Toast + "Contact support"
Render crash            ErrorBoundary           Fallback UI with retry
```

---

## D. Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|:----------:|------------|
| **JWT in localStorage → XSS vulnerability** | Token theft | Low | CSP headers help. Consider httpOnly cookies in future (requires backend change). |
| **`injectAuthStore` circular dependency workaround** | Auth headers silently missing if store is tree-shaken | Low | Tested in build. Only happens if `use-auth-store.ts` is never imported. |
| **Zod v3 vs v4 version conflict** | Type errors | Medium | Pinned to Zod v3. Monitor `@hookform/resolvers` for Zod v4 support. |
| **shadcn base-nova style is new** | Component API changes between versions | Medium | The shadcn base-nova style is pre-v1. Component APIs may change. Pin shadcn versions in `package.json`. |
| **School isolation only on backend** | Cross-school data displayed in browser | Low | School context is loaded and available in the store. Feature modules must use `school_id` in queries. |

---

## E. Improvements

### Must-Have Before Production
- [ ] Add CSP headers in `next.config.ts` (security)
- [ ] Add Sentry/Rollbar integration for error monitoring
- [ ] Add E2E test suite (Playwright)

### Should-Have Before Beta
- [ ] Add "Saved Views" to DataTable (localStorage-backed)
- [ ] Add direct "Go to page" input in pagination
- [ ] Add keyboard shortcut system (`Ctrl+K` command palette)
- [ ] Extract icon map from `sidebar.tsx` into reusable utility
- [ ] Add loading spinners/skeletons for page transitions

### Nice-to-Have
- [ ] Add `useOnlineStatus` integration with sonner toasts
- [ ] Server-side rendering audit for auth pages
- [ ] Add `next-themes` for more robust theme switching
- [ ] Move `ROUTE_ROLES` check to a reusable middleware utility

---

## F. Production Readiness Score

| Category | Score | Notes |
|----------|:-----:|-------|
| **Architecture** | 9/10 | Clean separation of concerns. Circular dependency workaround is the only wart. |
| **Authentication** | 9/10 | Complete login/logout/session/role flow. Token expiry is reactive only (no proactive JWT check). |
| **API Layer** | 9/10 | Interceptors, error handling, retry. Retry only via TanStack Query, not Axios itself. |
| **State Management** | 9/10 | Right-sized stores. No over-engineering. Persist middleware works correctly. |
| **Design System** | 8/10 | 27 components installed. Border radius doesn't exactly match spec (10px button, 10px card vs spec 16px). |
| **Layout System** | 9/10 | Responsive, accessible, auto-breadcrumbs. Public layout not separated from auth layout. |
| **Theme System** | 9/10 | Complete light/dark mode. Design tokens mapped correctly. |
| **Form Architecture** | 7/10 | `useZodForm` uses `any` internally for build compatibility. FormControl doesn't cloneElement ARIA to inputs. |
| **Table Architecture** | 9/10 | All requested features present except Saved Views. Loading skeleton, empty state, bulk selection. |
| **Error Handling** | 8/10 | Offline detection, error boundary, fallback, toasts. No global mutation error handler. |
| **Security** | 7/10 | CSP headers missing. JWT in localStorage (acceptable tradeoff). Role protection works. |
| **Build Verification** | ✅ | **Build passes with 0 errors.** |

### Overall Production Readiness: **84%**

**Phase F2 (Admin Web screens) can start now.** The foundation is complete, build-verified, and ready for feature development. The remaining 16% consists of security hardening (CSP), accessibility improvements (Form ARIA), and quality-of-life features (Saved Views, keyboard shortcuts) that can be addressed iteratively alongside feature development.

---

*End of Frontend Phase F1 Foundation Blueprint*
