# Ocean Motors – Car Dealer Website

A production-ready dealership platform built with Next.js, TypeScript, Tailwind CSS, Supabase, and Cloudinary. The application is designed for fast vehicle browsing, efficient lead generation, and a streamlined administrative workflow.

## Live Demo

🌐 https://oceanmotors.app

## Features

- Modern responsive dealership website
- Vehicle inventory management
- Vehicle detail pages
- Lead and viewing request forms
- Secure admin dashboard
- Cloudinary image management
- Supabase database and authentication
- Demo mode for local development
- Optional email notifications via Resend

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Supabase
- Cloudinary
- Resend (optional)
- Vitest

---

# Local Setup

1. Install dependencies

```bash
npm.cmd install
```

2. Copy the environment file

```bash
cp .env.example .env.local
```

3. Configure:

- Supabase
- Cloudinary
- Resend (optional)

4. Start the development server

```bash
npm.cmd run dev
```

---

# Environment Variables

Required:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `ADMIN_NOTIFICATION_EMAIL`

Optional:

- `RESEND_API_KEY`

---

# Demo Mode

If Supabase is not configured, the application automatically runs in Demo Mode.

Demo Mode includes:

- Demo vehicle inventory
- Demo admin access
- Fully functional UI for local evaluation

Data is not persisted between application restarts.

---

# Supabase Setup

1. Create a new Supabase project.

2. Run every SQL migration inside:

```
supabase/migrations/
```

Either:

Dashboard SQL Editor

```
001_initial_schema.sql
002_add_vehicle_stock_code.sql
003_add_lead_inbox_state.sql
```

or

```bash
supabase db push
```

3. (Optional)

Load demo data

```
supabase/seed/001_demo_seed.sql
```

4. Configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

5. Create an admin user inside Supabase Auth.

6. Grant admin access

```sql
insert into public.admin_profiles (user_id, email, full_name)
values (
    '<auth_user_uuid>',
    'admin@example.com',
    'Admin Name'
);
```

Remove admin access:

```sql
delete
from public.admin_profiles
where user_id = '<auth_user_uuid>';
```

---

# Supabase Connection Layer

Browser client

```
lib/supabase/client.ts
```

SSR client

```
lib/supabase/server.ts
```

Admin client

```
lib/supabase/admin.ts
```

Middleware

```
proxy.ts
lib/supabase/middleware.ts
```

Typed schema

```
types/database.ts
```

---

# Supabase Verification

Read-only verification

```bash
npm.cmd run supabase:check
```

Read, write and cleanup verification

```bash
npm.cmd run supabase:check:write
```

The write test inserts a temporary draft vehicle before automatically deleting it.

---

# Cloudinary Setup

Configure:

- Cloud Name
- API Key
- API Secret

Vehicle images are uploaded directly to Cloudinary whenever credentials are available.

Sync utility:

```
scripts/sync-cloudinary-vehicle-images.mjs
```

Documentation:

```
scripts/README-cloudinary-sync.md
```

---

# Resend Setup

Resend is optional.

Without `RESEND_API_KEY`:

- Forms continue saving successfully
- Email notifications are skipped

When email delivery is enabled:

- Configure `RESEND_API_KEY`
- Configure `ADMIN_NOTIFICATION_EMAIL`

---

# Verification Commands

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

---

# Deployment

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Configure all required environment variables.
4. Run the Supabase migrations.
5. (Optional) Seed demo data.
6. Deploy.

After deployment verify:

- Inventory pages
- Vehicle pages
- Admin login
- Forms
- Cloudinary uploads
- Image synchronization

---

# Release Smoke Test

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e
```

---

# Post Deployment Checklist

- Verify admin authentication
- Create and edit vehicles
- Test row and bulk actions
- Verify Cloudinary images
- Submit a lead form
- Verify lead appears in `/admin/leads`
- Verify Resend notifications (if enabled)

---

# Project Documentation

- [PLAN.md](./PLAN.md)
- [DECISIONS.md](./DECISIONS.md)
- [Project Scope](./docs/01-project-scope.md)
- [Site Map](./docs/02-site-map.md)
- [User Flows](./docs/03-user-flows.md)
- [Tech Stack](./docs/04-tech-stack.md)
- [Database Schema](./docs/05-database-schema.md)
- [Content Plan](./docs/06-content-plan.md)
- [SEO Plan](./docs/07-seo-plan.md)
- [UI / UX Rules](./docs/08-ui-ux-rules.md)
- [Feature Roadmap](./docs/09-feature-roadmap.md)
- [Deployment Plan](./docs/10-deployment-plan.md)
- [Admin Workflow](./docs/11-admin-workflow.md)
