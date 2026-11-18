---
name: talaei-architecture-map
description: Architectural map and fast-navigation guide for the Talaei (طلایی) project. Use this whenever touching code, fixing bugs, or adding features in the project to locate files instantly without scanning unnecessary code.
---

# Talaei Project Architecture Map & Fast Navigation

When working on any task in the Talaei project, **DO NOT scan all files or search blindly**. Use this lookup table to directly open and edit the exact files.

## Project Structure Overview

```
/src
├── components/          # Reusable and Domain-specific UI Components
│   ├── admin/          # Admin panels (Staff, QC, Pricing, Attendance, SLA, etc.)
│   ├── ceo/            # CEO dashboard and executive views
│   ├── technician/     # Technician screens (Job details, checklists, actions)
│   ├── warehouse/      # Warehouse and inventory modals/views
│   ├── measurement/    # Measurement and installation views
│   ├── navigation/     # Tabs and navigation bars
│   ├── common/         # Generic modals (Confirm, Alert, etc.)
│   └── ui/             # Reusable primitives (Buttons, Inputs, Badges)
├── utils/              # Business logic, state persistence, API clients
│   ├── supabase.ts     # Direct Supabase API queries & mutations
│   ├── storage.ts      # LocalStorage & offline caching utilities
│   ├── offlineQueue.ts # Offline mutation queue and background synchronization
│   ├── qcWorkflow.ts   # QC process & state machines
│   ├── jalali.ts       # Jalali (Shamsi) date conversions
│   ├── roleGuards.ts   # Role-based access control (Admin, CEO, Tech, etc.)
│   └── sla.ts          # SLA calculations and deadlines
├── types/
│   └── index.ts        # All TypeScript interfaces, roles, tickets, proposals
└── App.tsx             # Main router, active user context, and top-level tab controller
```

## Quick Reference by Feature

| What you need to touch | Target Directory / File |
| :--- | :--- |
| **User Roles & Auth** | `src/types/index.ts`, `src/utils/roleGuards.ts`, `src/components/LoginModal.tsx` |
| **Supabase Queries & DB** | `src/utils/supabase.ts`, `supabase/migrations/` |
| **Tickets / Orders** | `src/components/TicketModal.tsx`, `src/components/admin/TicketTable.tsx` |
| **Technician Actions** | `src/components/technician/`, `src/utils/offlineQueue.ts` |
| **QC & Handover** | `src/components/HandoverCertificateModal.tsx`, `src/utils/qcWorkflow.ts` |
| **Warehouse & Stock** | `src/components/warehouse/`, `src/utils/materialRequests.ts` |
| **Jalali Dates / Calendar** | `src/utils/jalali.ts` |
| **UI Primitives** | `src/components/ui/` |

## Golden Rules for Fast Development in Talaei
1. **Never dump new UI into `src/App.tsx`:** `App.tsx` is already over 2,500 lines. Always create a new component under `src/components/<domain>/` and import it.
2. **Use Existing Types:** Inspect `src/types/index.ts` first before inventing new data structures.
3. **Keep edits isolated:** Target the specific leaf component instead of touching global orchestrators.
