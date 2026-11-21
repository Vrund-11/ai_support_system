# SupportPilot Stitch Design System Specification (DESIGN.md)

This document defines the complete visual style, design tokens, color palette, typography, and responsive component styling for SupportPilot in Stitch.

---

## 1. Brand & Design Principles

- **Speed & Clarity**: High-density data tables, clean margins, low cognitive load.
- **Calm Professionalism**: Neutral zinc backgrounds, crisp border lines, indigo primary brand accents, semantically clear status & priority colors.
- **Responsive-First**: Seamless desktop (1440px / 1024px) to mobile (375px / 390px) transitions.
- **Dark & Light Mode Parity**: Optimized for light mode daylight operations and dark mode NOC / shift operations.

---

## 2. Design Tokens

### 2.1 Theme Configuration (Stitch DesignTheme)

- **headlineFont**: `INTER`
- **bodyFont**: `INTER`
- **labelFont**: `JETBRAINS_MONO`
- **roundness**: `ROUND_EIGHT` (8px standard corner radius, 12px for modal cards, 9999px for status pills)
- **colorMode**: `LIGHT` (with dark mode variant)
- **customColor**: `#4f46e5` (Indigo 600)
- **overridePrimaryColor**: `#4f46e5`
- **overrideSecondaryColor**: `#0ea5e9` (Sky 500)
- **overrideTertiaryColor**: `#8b5cf6` (Violet 500)
- **overrideNeutralColor**: `#09090b` (Zinc 950)

### 2.2 Color Roles & Semantics

| Token            | Light Mode Value       | Dark Mode Value        | Usage                                 |
| ---------------- | ---------------------- | ---------------------- | ------------------------------------- |
| `background`     | `#f8fafc` (slate-50)   | `#09090b` (zinc-950)   | App root background                   |
| `surface`        | `#ffffff` (white)      | `#18181b` (zinc-900)   | Cards, modals, sidebars               |
| `surface-subtle` | `#f1f5f9` (slate-100)  | `#27272a` (zinc-800)   | Table headers, secondary buttons      |
| `border`         | `#e2e8f0` (slate-200)  | `#27272a` (zinc-800)   | Dividers, card borders, input borders |
| `text-primary`   | `#0f172a` (slate-900)  | `#fafafa` (zinc-50)    | Main headlines, body copy             |
| `text-secondary` | `#64748b` (slate-500)  | `#a1a1aa` (zinc-400)   | Labels, timestamps, hints             |
| `primary`        | `#4f46e5` (indigo-600) | `#6366f1` (indigo-500) | Primary CTA buttons, active tabs      |
| `primary-hover`  | `#4338ca` (indigo-700) | `#4f46e5` (indigo-600) | Hovered primary buttons               |

### 2.3 Semantic Ticket & SLA Status Colors

| Role                 | Badge Background       | Badge Text              | Border    | Purpose                     |
| -------------------- | ---------------------- | ----------------------- | --------- | --------------------------- |
| **NEW**              | `#eff6ff` (blue-50)    | `#1d4ed8` (blue-700)    | `#bfdbfe` | Fresh unassigned ticket     |
| **OPEN**             | `#f0fdf4` (emerald-50) | `#15803d` (emerald-700) | `#bbf7d0` | Active under agent handling |
| **PENDING_CUSTOMER** | `#fffbeb` (amber-50)   | `#b45309` (amber-700)   | `#fde68a` | Awaiting client reply       |
| **ON_HOLD**          | `#faf5ff` (purple-50)  | `#7e22ce` (purple-700)  | `#e9d5ff` | Waiting third-party / dev   |
| **RESOLVED**         | `#f8fafc` (slate-100)  | `#475569` (slate-600)   | `#cbd5e1` | Successfully closed         |
| **CLOSED**           | `#f1f5f9` (slate-100)  | `#94a3b8` (slate-400)   | `#e2e8f0` | Terminal archived state     |

### 2.4 Priority Tokens

- **LOW**: `#64748b` (Slate 500) — Minor cosmetic / non-urgent question.
- **MEDIUM**: `#3b82f6` (Blue 500) — Standard operational issue.
- **HIGH**: `#f59e0b` (Amber 500) — Degraded service / VIP customer.
- **URGENT**: `#ef4444` (Red 500) — Outage, security, data loss.
