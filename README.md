# TenantVault

**Multi-tenant inventory platform with provable, defense-in-depth tenant isolation.**

Every request, query, file, cache entry and AI answer in TenantVault is locked to a single tenant. Isolation is enforced at
four independent layers, from the HTTP middleware down to PostgreSQL row-level security. A built-in attack simulator
proves it live against the running system.

---

## Table of contents

- [Highlights](#highlights)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
  - [Option A: local PostgreSQL, no Docker](#option-a-local-postgresql-no-docker)
  - [Option B: Docker Compose](#option-b-docker-compose)
  - [Frontend](#frontend)
- [Demo accounts](#demo-accounts)
- [Pages](#pages)
- [Tenant isolation](#tenant-isolation)
- [Roles and permissions](#roles-and-permissions)
- [API reference](#api-reference)
- [Configuration](#configuration)
- [Live demo script](#live-demo-script)
- [Tests](#tests)
- [Migrations](#migrations)
- [Troubleshooting](#troubleshooting)

---

## Highlights

| | |
|---|---|
| **Four isolation layers** | Tenant middleware, EF Core global query filters, a SaveChanges interceptor and PostgreSQL RLS. Any one of them stops a leak on its own. |
| **Fail-closed** | A missing or unknown tenant is rejected. With no tenant set, the database returns zero rows. The API refuses to start if a tenant table lacks a filter. |
| **Attack simulator** | One click runs 8 real attacks (header spoofing, forged JWT, cross-tenant read and write, path traversal, cache probe, raw SQL bypass) and shows each one blocked. |
| **Audit trail** | Logins, changes, exports, role denials and cross-tenant attempts are recorded. Cross-tenant attempts are logged for both the target tenant and the attacker's own tenants. |
| **Per-tenant roles** | One user can be Admin in one tenant, Staff in another and Viewer in a third. Roles are enforced on the server. |
| **Secure storage** | Server-generated S3 keys, magic-byte validation, AES-256 encryption at rest and 5-minute presigned URLs. No public URLs. |
| **Inventory features** | Products, stock movements, low-stock, dead-stock and anomaly alerts, analytics, reorder predictions, CSV/JSON export and an AI assistant scoped to the active tenant. |
| **Modern UI** | Light and dark mode, animated sliders, count-up statistics, page transitions and per-tenant accent colours. |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript (strict), Vite, TanStack Query, React Router, React Hook Form + Zod, Tailwind CSS, lucide-react |
| API | ASP.NET Core 8 (controllers), FluentValidation, Serilog, Swagger, rate limiting |
| Data | EF Core 8 + Npgsql, PostgreSQL 16+ with row-level security |
| Auth | JWT (HS256), BCrypt (work factor 12) |
| Storage | Amazon S3 (LocalStack for local development) |
| Tests | xUnit, Testcontainers, WebApplicationFactory |

---

## Project structure

```
tenantvault/
├── src/                          # Frontend (React)
│   ├── api/                      # Axios client and endpoint wrappers
│   ├── components/
│   │   ├── layout/               # AppShell, Sidebar, Header, TenantSwitcher, AuthShowcase
│   │   ├── products/             # Product table, form, filters, image uploader
│   │   ├── security/             # Isolation simulator, access-denied card
│   │   └── ui/                   # Button, Table, Modal, Carousel, RangeSlider, AnimatedNumber, ThemeToggle…
│   ├── context/                  # Auth and tenant contexts
│   ├── hooks/                    # Data hooks (products, tenant switch, debounce)
│   ├── lib/                      # Formatting, errors, tenant colours, theme
│   ├── pages/                    # One file per route
│   └── types/
├── backend/
│   ├── src/
│   │   ├── TenantVault.Domain/          # Entities, roles, tenant abstractions
│   │   ├── TenantVault.Application/     # DTOs, services, validators, exceptions
│   │   ├── TenantVault.Infrastructure/  # EF Core, interceptors, RLS migrations, S3, seeding, simulator
│   │   └── TenantVault.Api/             # Controllers, middleware, filters, Program.cs
│   ├── tests/TenantVault.Tests/         # Isolation, RLS, pooling, static-analysis and startup tests
│   └── docker-compose.yml
├── .env.example
└── package.json
```

---

## Getting started

### Prerequisites

- **Node.js 18+** and npm
- **.NET 8 SDK**
- **PostgreSQL 16 or newer** (local install), or Docker Desktop
- *Optional:* LocalStack or an AWS S3 bucket, for product image uploads

### Option A: local PostgreSQL, no Docker

The API creates the database, applies migrations, creates the restricted `tenantvault_app` role and seeds demo data on
first start. You don't need to run `psql` or create anything by hand.

It uses two connection strings:

- **Migrations**: your PostgreSQL superuser (for example `postgres`). Used only at startup to create the schema, role and RLS policies.
- **Default**: the least-privilege `tenantvault_app` role that the API uses for every request. It cannot bypass RLS.

**PowerShell (Windows):**

```powershell
cd backend
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:ConnectionStrings__Migrations = "Host=localhost;Port=5432;Database=tenantvault;Username=postgres;Password=<your-postgres-password>"
$env:ConnectionStrings__Default    = "Host=localhost;Port=5432;Database=tenantvault;Username=tenantvault_app;Password=app_pw"
dotnet run --project src/TenantVault.Api
```

**Bash (macOS/Linux):**

```bash
cd backend
export ASPNETCORE_ENVIRONMENT=Development
export ConnectionStrings__Migrations="Host=localhost;Port=5432;Database=tenantvault;Username=postgres;Password=<your-postgres-password>"
export ConnectionStrings__Default="Host=localhost;Port=5432;Database=tenantvault;Username=tenantvault_app;Password=app_pw"
dotnet run --project src/TenantVault.Api
```

Wait for these log lines:

```
Database migrations applied
Seeded 3 tenants, 4 demo users (password Password123!)
Now listening on: http://localhost:5000
```

A warning that says `S3 is unreachable` only means image uploads are disabled until S3 is available. Everything else works.

Swagger UI: <http://localhost:5000/swagger>

> Never commit real database passwords. Pass them as environment variables as shown above.

### Option B: Docker Compose

Runs PostgreSQL, LocalStack (S3) and the API together:

```bash
cd backend
docker compose up --build
```

### Frontend

```bash
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm run dev
```

Open <http://localhost:5173>. The intro page is at <http://localhost:5173/home>.

---

## Demo accounts

All accounts use the password **`Password123!`**.

| Email | Access |
|-------|--------|
| `multi@demo.com` | **Admin** of Acme Corp, **Staff** of Globex Ltd, **Viewer** of Initech. Use this account to demo tenant switching and roles. |
| `acme@demo.com` | Admin of Acme Corp |
| `globex@demo.com` | Admin of Globex Ltd |
| `initech@demo.com` | Admin of Initech |

`SKU-001` exists in all three tenants as a different product. That makes it easy to show that identical identifiers never collide across tenants.

Each tenant has its own accent colour across the UI: Acme is blue, Globex is green and Initech is red.

---

## Pages

| Route | Description |
|-------|-------------|
| `/home` | Public intro page covering features, isolation layers, simulator, roles and tech stack |
| `/login`, `/register` | Sign-in and sign-up, with an animated feature slider and one-click demo credentials |
| `/dashboard` | Highlights slider, count-up stats, recent stock movements and alerts |
| `/products` | Search, filter, paginate, create, edit and delete products |
| `/products/:id` | Product detail, stock value, image and movement history |
| `/alerts` | Low-stock, dead-stock and anomaly alerts with severity |
| `/analytics` | Movement trend chart with a 7–90 day range slider, value by category, dead stock and reorder predictions |
| `/ai` | AI assistant that answers only from the active tenant's data |
| `/security` | Isolation-layer slider, sign-in stats, cross-tenant attempts and recent sign-ins (refreshes every 15 s) |
| `/security/simulator` | Runs the 8-attack isolation test live |
| `/audit` | Tenant audit log |
| `/settings` | Your role and permissions, the permission matrix and CSV/JSON export |

**UI features:** light and dark mode (follows the OS until you pick one, then remembers your choice), auto-playing and
swipeable sliders, animated charts and counters, page transitions, staggered list entrances and respect for the OS
"reduce motion" setting.

---

## Tenant isolation

1. **Tenant middleware**: resolves the tenant from the subdomain or the `X-Tenant-Id` header, then validates it against the JWT `tenant_ids` claim **and** the membership table.
   - No tenant returns `400 TENANT_MISSING`, an unknown tenant returns `404 TENANT_NOT_FOUND`, and a tenant you don't belong to returns `403 TENANT_FORBIDDEN`.
   - Every 403 is audited as a `cross_tenant_attempt`.
   - The tenant binding is locked once it is set for a request.
2. **EF Core global query filters**: added by reflection to every `ITenantEntity`. With no tenant bound, queries return zero rows.
3. **SaveChanges interceptor**: stamps new rows with the current tenant and throws `TenantMismatchException` on any cross-tenant update or delete.
4. **PostgreSQL RLS**: `ENABLE` and `FORCE ROW LEVEL SECURITY` on `products`, `stock_movements` and `audit_entries`, using the policy `tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid`.
   - The API connects as `tenantvault_app` (`NOSUPERUSER NOBYPASSRLS`).
   - A connection interceptor sets `app.tenant_id` when a connection opens and resets it when the connection closes, so pooled connections never carry a stale tenant.
5. **Storage**: S3 keys are generated by the server as `tenants/{tenantId}/products/{productId}/{guid}{ext}`.
   - Uploads must be PNG, JPEG or WebP, 5 MB max, and pass a magic-byte check.
   - Objects are encrypted with SSE-S3 (AES-256).
   - Presigned URLs expire after 5 minutes and are only issued for keys under the tenant's prefix.
6. **Cache**: every cache key is prefixed with `tenant:{id}:`.
7. **Startup assertion**: the API refuses to boot if an entity with a `TenantId` neither implements `ITenantEntity` nor carries a `[TenantAgnostic]` justification.

### Isolation simulator

`POST /security/simulate-attack` runs these attacks, each in its own DI scope, with the simulated write rolled back:

| # | Attack | Expected result |
|---|--------|-----------------|
| 1 | Missing tenant header | `400` |
| 2 | Header spoof to another tenant | `403` |
| 3 | Forged JWT | `401` |
| 4 | Cross-tenant product read | `404` |
| 5 | Cross-tenant product write | `404` (and the interceptor rejects a forced write) |
| 6 | Path traversal filename | key rewritten by the server |
| 7 | Cache probe without tenant key | cache miss |
| 8 | Raw SQL around the ORM | `0 rows` (PostgreSQL RLS) |

---

## Roles and permissions

| Permission | Admin | Staff | Viewer |
|------------|:-----:|:-----:|:------:|
| Read products, dashboard, alerts, analytics, AI | ✓ | ✓ | ✓ |
| Create, edit and scan products, manage images | ✓ | ✓ | |
| Delete products | ✓ | | |
| Security dashboard, export | ✓ | ✓ | |
| Audit log | ✓ | | |

A denied request returns `403 ROLE_FORBIDDEN` with the reason, and the denial is audited as `role_denied`. The UI hides
actions your role can't perform, but the server is the source of truth.

---

## API reference

Routes have no `/api` prefix. Every error body is `{ error, code, traceId? }`. Validation failures also include
`errors: { field: [messages] }`.

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` |
| Context (no tenant) | `GET /me`, `GET /tenants`, `POST /tenants` |
| Products | `GET/POST /products`, `GET /products/categories`, `GET/PUT/DELETE /products/{id}`, `POST/DELETE /products/{id}/image` (multipart field `file`), `GET /products/{id}/image-url`, `GET /products/{id}/movements`, `POST /products/{id}/scan` |
| Insights | `GET /dashboard`, `GET /alerts?type=`, `GET /analytics/trends?days=`, `GET /analytics/dead-stock`, `GET /analytics/turnover` |
| Security | `GET /audit`, `GET /security/dashboard`, `POST /security/simulate-attack`, `GET /security/context?reason=switch` |
| Export and AI | `GET /export/products.csv`, `GET /export/products.json`, `POST /ai/assistant`, `GET /ai/stockout-prediction`, `GET /ai/reorder-recommendation`, `GET /ai/anomalies` |

Tenant-scoped endpoints require `Authorization: Bearer <token>` and `X-Tenant-Id: <tenant-uuid>`.

**Rate limits:** 10 auth attempts per minute per IP, 10 simulator runs per minute, and 300 requests per minute per user.
Exceeding them returns `429 RATE_LIMITED`.

---

## Configuration

Settings live in `backend/src/TenantVault.Api/appsettings*.json`. Any of them can be overridden with environment
variables, using `__` as the section separator.

| Setting | Env variable | Purpose |
|---------|--------------|---------|
| `ConnectionStrings:Default` | `ConnectionStrings__Default` | Connection used by the API (`tenantvault_app` role) |
| `ConnectionStrings:Migrations` | `ConnectionStrings__Migrations` | Superuser connection for migrations and role setup |
| JWT secret | `JWT_SECRET` | HS256 signing key, at least 32 bytes. **Required in production.** |
| `Jwt:ExpiryMinutes` | `Jwt__ExpiryMinutes` | Access token lifetime (default 30) |
| `S3:ServiceUrl` | `S3__ServiceUrl` | S3 endpoint. Leave empty to target real AWS. |
| `S3:BucketName` | `S3__BucketName` | Bucket name (default `tenantvault`) |
| `Cors:Origins` | `Cors__Origins__0` | Allowed frontend origins |
| `Seed:Enabled` | `Seed__Enabled` | Seed demo data outside Development |
| `RateLimiting:*` | `RateLimiting__AuthPerMinute`, … | Rate-limit thresholds |

Frontend: `VITE_API_URL` in `.env` (default `http://localhost:5000`).

---

## Live demo script

1. **Tenant switching:** sign in as `multi@demo.com` and switch between Acme, Globex and Initech from the header. The data, accent colour and permissions change with each switch.
2. **Roles:** in Initech (Viewer) the create, edit and delete actions disappear. In Globex (Staff) delete is hidden.
3. **Same URL, different tenant:** open an Acme product, switch to Globex and reload the same URL. You get *not found*.
4. **Attack simulator:** open **Security → Isolation Simulator** and click **Run Isolation Test**. All 8 attacks are blocked.
5. **Audit trail:** open **Audit** as an admin and find the recorded `cross_tenant_attempt` entries.
6. **RLS inside PostgreSQL:** connect as the app role and see the database enforce isolation by itself:

   ```sql
   -- psql -h localhost -U tenantvault_app -d tenantvault   (password: app_pw)
   SELECT count(*) FROM products;                                   -- 0: no tenant set, fail-closed
   SELECT id, slug FROM tenants;
   SELECT set_config('app.tenant_id', '<acme-id>', false);
   SELECT count(*) FROM products;                                   -- Acme rows only
   SELECT count(*) FROM products WHERE tenant_id = '<globex-id>';   -- 0, even with an explicit filter
   SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'tenantvault_app';
   ```

---

## Tests

```bash
cd backend
dotnet test
```

- **StaticAnalysisTests**: fails if `src/` uses `IgnoreQueryFilters`, `FromSqlRaw`, `ExecuteSqlRaw` or their siblings, contains TODO markers, or has controllers that touch the DbContext.
- **StartupTests**: every entity with a `TenantId` is isolated, and every tenant entity has a query filter.
- **IsolationTests**, **RlsTests** and **PoolingTests** use Testcontainers (PostgreSQL with the real API, migrations and seed data). They are skipped when Docker isn't available.

Frontend type-check and production build:

```bash
npm run typecheck
npm run build
```

---

## Migrations

```bash
cd backend
dotnet tool restore
TENANTVAULT_DESIGN_CONNECTION="Host=localhost;Database=tenantvault;Username=postgres;Password=<password>" \
  dotnet ef migrations add <Name> --project src/TenantVault.Infrastructure --output-dir Persistence/Migrations
```

The `RowLevelSecurity` migration is hand-written. Every new tenant-owned table needs RLS policies added in a migration like it.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `MSB3027: Could not copy … The file is locked by: "TenantVault.Api"` | An earlier API instance is still running. Stop it with `Get-Process TenantVault.Api \| Stop-Process` (PowerShell), then run again. |
| `28P01: password authentication failed for user "postgres"` | The password in `ConnectionStrings__Migrations` is wrong. Use your PostgreSQL superuser password. |
| `S3 is unreachable; image uploads will fail` | Only affects image uploads. Start LocalStack on port 4566, or point `S3__ServiceUrl` at a real bucket. |
| `psql` not found | It's in `C:\Program Files\PostgreSQL\<version>\bin\psql.exe`. It isn't needed to run the app, because the API creates the database itself. |
| Frontend shows network errors | Check the API is listening on `http://localhost:5000` and that `VITE_API_URL` matches. |
| New styles or dark mode don't appear | Hard-refresh the browser (Ctrl+Shift+R), or restart `npm run dev` after changing `tailwind.config.js` or `index.html`. |
