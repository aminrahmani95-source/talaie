---
name: fast-refactor-decompose
description: Step-by-step instructions and patterns to safely extract components and modals out of monolithic files (like App.tsx) into isolated files, dramatically accelerating development and reducing AI latency.
---

# Fast Refactor & Component Decompose Guide

Use this skill whenever editing or refactoring monolithic files (like `src/App.tsx`) to decompose them into clean, standalone modules.

## Why Decompose?
Editing a 2,500-line file causes high token consumption, slow AI response times, merge conflicts, and regression bugs. Breaking files into modular components cuts task completion time from hours to minutes.

## Safe Decomposition Steps

### 1. Identify Component Boundaries
Look inside `App.tsx` for self-contained blocks:
- Large Modal dialogues (e.g. SettingsModal, FilterModal)
- Individual Tab views (e.g. AdminTab, CeoTab, TechView)
- Sub-headers, sidebars, or toolbars

### 2. Extract Props & Interfaces
Create an explicit interface for the component:
```tsx
// src/components/<domain>/<ComponentName>.tsx
interface ComponentProps {
  currentUser: User;
  onClose: () => void;
  // pass only what is needed, avoid passing whole global state objects
}
```

### 3. Move Handlers & Helpers
- If a helper function is only used inside the extracted component, move it into the component file or a dedicated utility in `src/utils/`.
- If an API call is made, use `src/utils/supabase.ts` instead of inline fetch logic.

### 4. Wire back into Parent
Replace the original 100-300 lines in `App.tsx` with a single clean import:
```tsx
import { ComponentName } from './components/<domain>/<ComponentName>';

// Inside JSX:
{showModal && <ComponentName onClose={() => setShowModal(false)} currentUser={currentUser} />}
```

### 5. Verification Checklist
- Run `npm run lint` or `npx oxlint` to ensure no unused variables or syntax issues.
- Run `npx tsc --noEmit` to verify TypeScript types match across imports.
