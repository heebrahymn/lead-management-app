# Lead Management Application

[![React](https://img.shields.io/badge/React-18.3-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E.svg?logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A powerful, enterprise-grade **Lead Management & CRM System** built with **React**, **TypeScript**, **Vite**, **Tailwind CSS**, **Shadcn UI**, and **Supabase**.

This application is designed for real-time lead tracking, multi-channel ad campaign performance monitoring (Google Ads & Meta Ads), WATI WhatsApp webhook lead automation, user access management (RBAC), audit logging, and automated daily PDF/Email reporting powered by Supabase Edge Functions & `pg_cron`.

---

## 🌟 Key Features

### 📊 Dashboard & KPI Overview
- **Executive Metrics**: Track Total Leads, Converted Leads, Pipeline Revenue Value, Conversion Rate (%), and Lead Growth.
- **Pipeline Breakdown**: Visual representation of lead distribution across statuses and sales channels.
- **Recent Activity Feed**: Real-time stream of lead actions, status updates, and user assignments.

### 👥 CRM & Lead Management
- **Full Lifecycle Tracking**: Status workflow covering `New` ➔ `Interested` ➔ `No Response` ➔ `Qualified` ➔ `Converted` ➔ `Lost` / `Closed`.
- **Multi-Source Attribution**: Track leads originating from `Calls`, `WhatsApp`, `Email`, `Walk-in`, `Google Ads`, `Meta Ads`, or `Existing Clients`.
- **Lead Assignment & Notes**: Assign leads to specific agents, log internal notes, set deal values, and schedule follow-ups.
- **Advanced Filtering & Search**: Instant full-text search, multi-select status and source filters, and date range picking.

### 💬 WATI WhatsApp Integration & Analytics
- **Live Webhook Integration**: Incoming messages from WATI WhatsApp API automatically parse and capture leads into the CRM.
- **Engagement Analytics**: Monitor message volume, average response times, active conversations, and lead conversion velocity.

### 🎯 Multi-Channel Ad Campaign Analytics
- **Google Ads Analytics**:
  - Track Impression volume, Clicks, Click-Through Rate (CTR), Cost-Per-Click (CPC), Total Spend, and Cost-Per-Lead (CPL).
  - Campaign & Ad Group level performance breakdown.
  - Conversion action mapping (e.g., calls, form submissions, alignment quotes).
- **Meta (Facebook & Instagram) Ads Analytics**:
  - Track impressions, spend, reach, CTR, link clicks, and lead volume across Meta ad sets.
  - Platform comparative metrics (Facebook vs Instagram).

### 📬 Automated Daily Email & PDF Reports
- **Serverless Scheduled Jobs**: Uses Supabase `pg_cron` and `pg_net` to trigger serverless Deno Edge Functions daily.
- **PDF Report Generation**: Edge Functions dynamically compile campaign performance statistics into branded PDF documents.
- **Automated Email Delivery**: Sends daily performance digests directly to stakeholders.

### 🛡️ User Management & Role-Based Access Control (RBAC)
- **Role Hierarchy**:
  - `superadmin`: Full system access, user role management, system settings, and audit logs.
  - `standard`: Full CRM lead editing, analytics viewing, and lead assignment.
  - `operator`: Read-only or restricted lead interaction role.
- **Row Level Security (RLS)**: Enforced directly at the PostgreSQL layer to ensure data isolation and secure API endpoints.
- **User Administration**: Admin interface for creating users, updating permissions, and managing team access.

### 📜 Audit Logging & Compliance
- **Complete Action Logs**: Records every lead creation, status change, user assignment, role update, and system configuration edit.
- **Audit Interface**: Filterable log view with timestamps, performing user ID, entity type, and payload details.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | React 18 (with Hooks & Functional Components) |
| **Language** | TypeScript 5.8 |
| **Build Tool & Bundler** | Vite 5.4 |
| **Styling & UI Components** | Tailwind CSS 3.4, Shadcn UI (Radix UI primitives), Lucide React icons |
| **State & Data Fetching** | TanStack React Query v5 |
| **Routing** | React Router DOM v6 |
| **Forms & Validation** | React Hook Form, Zod schema validation |
| **Data Visualization** | Recharts |
| **PDF Generation** | jsPDF & jsPDF-AutoTable |
| **Database & Auth** | Supabase (PostgreSQL with RLS, JWT Authentication) |
| **Serverless & Cron** | Supabase Edge Functions (Deno TS), `pg_cron`, `pg_net` |
| **Testing** | Vitest, React Testing Library, JSDOM |

---

## 📁 Directory Structure

```text
lead-management-app/
├── public/                 # Static public assets & branding
├── src/
│   ├── components/         # Reusable UI & Layout Components
│   │   ├── ui/             # Shadcn UI base primitives (Button, Dialog, Table, etc.)
│   │   ├── AddLeadDialog.tsx
│   │   ├── AppHeader.tsx
│   │   ├── AppLayout.tsx
│   │   ├── AppSidebar.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── StatusBadge.tsx
│   │   └── StatusPicker.tsx
│   ├── hooks/              # Custom React hooks (useAuth, useLeads, etc.)
│   ├── integrations/       # Supabase client setup & TypeScript client bindings
│   ├── lib/                # Utility helper functions & formatters
│   ├── pages/              # Primary Application Views
│   │   ├── Analytics.tsx
│   │   ├── AuditLogs.tsx
│   │   ├── Auth.tsx
│   │   ├── GoogleAdsAnalytics.tsx
│   │   ├── Index.tsx           # Lead Management / CRM Table View
│   │   ├── LeadDetail.tsx
│   │   ├── MetaAdsAnalytics.tsx
│   │   ├── Overview.tsx        # Executive Dashboard
│   │   ├── Settings.tsx
│   │   ├── Users.tsx
│   │   └── WhatsAppAnalytics.tsx
│   ├── App.tsx             # Root Application Routing & Query Client Provider
│   └── main.tsx            # Vite Entry point
├── supabase/
│   ├── functions/          # Deno Edge Functions for APIs & Scheduled Cron Reports
│   │   ├── admin-create-user/
│   │   ├── daily-google-ads-pdf-report/
│   │   ├── daily-google-ads-report/
│   │   ├── daily-meta-ads-pdf-report/
│   │   ├── daily-meta-ads-report/
│   │   ├── daily-whatsapp-report/
│   │   └── wati-webhook/
│   ├── migrations/         # PostgreSQL database schema migrations & RLS policies
│   ├── schema.sql          # Complete exported database structure
│   └── config.toml         # Supabase CLI configuration
├── index.html
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── vitest.config.ts
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your local development environment:
- **Node.js**: `v18.0.0` or higher (or **Bun**)
- **npm** or **bun**
- **Git**
- **Supabase CLI** (optional, for local Edge Function testing)

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/heebrahymn/lead-management-app.git
   cd lead-management-app
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   # or using Bun
   bun install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root of the project:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Run the Local Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:8080` (or the port specified in terminal).

---

## 📦 Database & Supabase Setup

### Database Migrations

If setting up a fresh Supabase project:

1. Link your local project to Supabase:
   ```bash
   npx supabase link --project-ref your-project-ref
   ```

2. Apply all database migrations:
   ```bash
   npx supabase db push
   ```

### Deploying Edge Functions

Deploy Deno edge functions for automated daily reporting and webhooks:

```bash
# Deploy all functions
npx supabase functions deploy admin-create-user
npx supabase functions deploy wati-webhook
npx supabase functions deploy daily-whatsapp-report
npx supabase functions deploy daily-google-ads-report
npx supabase functions deploy daily-google-ads-pdf-report
npx supabase functions deploy daily-meta-ads-report
npx supabase functions deploy daily-meta-ads-pdf-report
```

---

## 🧪 Available Scripts

In the project directory, you can run:

- `npm run dev`: Starts the Vite development server with HMR.
- `npm run build`: Compiles TypeScript and builds the production bundle into `/dist`.
- `npm run build:dev`: Builds the app using development mode.
- `npm run preview`: Previews the production build locally.
- `npm run lint`: Runs ESLint across all code files.
- `npm run test`: Runs unit and integration tests using Vitest.

---

## 🔒 Security & Best Practices

- **Row Level Security (RLS)**: Enforced across all tables (`leads`, `audit_logs`, `google_ads_metrics`, `meta_ads_metrics`, `whatsapp_messages`) to prevent unauthorized cross-tenant or role access.
- **Role Enforcement**: User actions and navigation routes are protected based on user roles (`superadmin`, `standard`, `operator`).
- **Secrets Management**: Sensitive API tokens (WATI credentials, Google Ads tokens, Meta Graph tokens, Service Role keys) are managed securely inside Supabase Vault / Edge Function secrets.

---

## 📄 License

This project is proprietary and confidential. All rights reserved.

---

## 👨‍💻 Maintainer

Developed and maintained by [Ayodele Ibraheem](https://github.com/heebrahymn).
