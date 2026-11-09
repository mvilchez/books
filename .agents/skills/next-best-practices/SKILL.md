# Next-Best-Practices: books Application

> **Context:** This skill provides domain-specific next-best-practices for the
> `books` reading analytics platform built with Next.js 16, Prisma 6, and
> PostgreSQL. It is intended to help developers make informed decisions about
> performance, maintainability, and correctness when working on this codebase.
## 🛠️ Performance Best Practices

### 1. Dashboard Load Performance

The project has been optimizing dashboard load times from an initial 56s/35s
down to a target <5s. Key achievements and ongoing practices:

- **JavaScript Optimization** (`next.config.ts` and `tsconfig.json`):
  - Target ES2017 + Node 20, avoiding unnecessary polyfill transpilation
  - Reduces bundle size and improves first-load parse time

- **Database Index Verification**:
  - Verified all necessary indexes exist on Book and book_tags tables
  - Key indexes: `Book_userId_idx`, `Book_userId_ano_status_idx`,
    `Book_userId_status_idx`

- **Prisma Query Optimization**:
  - The dashboard renders with 3 Prisma queries:
    - `getAvailableReadingYears`
    - `getYearKpis`
  - Consider caching strategies for frequently accessed data

### 2. Image & Asset Optimization

- **Lazy-load book covers** - don't block initial paint
- **Font preloading** for Geist font
- Use Tailwind CSS 4's built-in optimization

### 3. Code Splitting & Lazy Loading

- Lazy-load non-critical components
- Server Components by default; `"use client"` only where interactivity is needed
- Dynamic imports for heavy components (charts, modals, etc.)

## 📚 References & Related Skills

This skill complements the other skills in `.agents/skills/`:

- **prisma-8**: Prisma 8 ORM operations, contract editing, migrations
- **prisma-composer**: Prisma Composer apps, modules, services deployment
- **prisma-platform-core-concepts**: Prisma Platform (Compute, Postgres, Storage)

For project-specific guidance, always refer to `CONTEXT.md` for the latest
architecture decisions and `PLAN.md` for the execution blueprint.

## 🚨 Common Pitfalls to Avoid

1. **Hydration mismatches**: Avoid computing "today" during render;
   use `useEffect` or static dates instead

2. **Wrong year source**: Reading year comes from tab name, not `Año` column;
   don't confuse the two

3. **Skipping tab filters**: Only process tabs starting with `Leidos/Leídos`;
   other tabs are intentionally skipped

4. **Server Component props**: Don't pass non-serializable props across
   Server/Client boundaries

5. **MariaDB assumptions**: MariaDB has been decommissioned; all new
   development uses PostgreSQL

6. **Over-engineering**: This project started as an Excel tracker - keep
   solutions proportionate to the problem

7. **Ignoring performance budgets**: Dashboard should load in <5s; monitor
   and regress proactively

8. **Hydration warnings**: With React 19 and Next.js 16, hydration mismatches
   will cause console errors and degraded performance

## ✅ Quick Checklist Before Committing

- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] `npm run lint` passes (no new warnings/errors)
- [ ] `npm run check:encapsulation` passes
- [ ] Relevant unit tests pass (`npm test`)
- [ ] Dashboard performance is acceptable (<5s load)
- [ ] Database migrations are tested against the target environment
- [ ] Environment variables are set correctly (not committed)
- [ ] Mobile responsiveness has been tested
- [ ] No `as` casts that could be replaced with proper typing
- [ ] Server/Client boundary props are all serializable