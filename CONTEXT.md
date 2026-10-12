# Technical Architecture & Context Continuity Blueprint: project "books"

**Author / Role:** Senior Software Engineer & Team Lead  
**Document Purpose:** Contextual Safe-Guard / Session Resumption Telemetry  
**System Target:** Full-Stack Reading Analytics Application (Next.js 15 + TypeScript)

---

## 1. Executive Summary & Goals
The objective of this project, named **`books`**, is to engineer a lightweight, high-performance web platform and Progressive Web App (PWA) to completely replace a multi-year legacy Excel spreadsheet used for personal reading tracking. 

The primary business goal is to **preserve and migrate a historical ledger containing multiple years of reading data with 100% data integrity**, while unlocking advanced server-side statistical matrix calculations and real-time interactive analytical dashboards.

---

## 2. Technical Stack Specifications
If this session breaks, the incoming AI engine must strictly maintain this architectural baseline:
*   **Framework:** Next.js 15+ (App Router, React Server Components, Server Actions for mutations).
*   **Language Ecosystem:** TypeScript 5.x running under strict compiler flags (`strictNullChecks`, `noImplicitAny`).
*   **Database & ORM:** Prisma ORM communicating with a managed PostgreSQL engine (Supabase in production, local Docker container for development).
*   **File Parsing Core:** ExcelJS (Streamed, non-blocking asynchronous workbook interpreter).
*   **Visualizations:** Recharts Framework (Reactive client wrappers optimized for Tailwind CSS canvas environments).

---

## 3. Data Schema & Spreadsheet Contract
The legacy Excel file contains 5 exact columns that map natively to the relational database structure. The system must process them using the following data typing parameters:

*   **`titulo` (Title):** String type. Combined with `authorId` to form a unique composite key (`@@unique([title, authorId])`) to enforce data ingestion idempotency.
*   **`autor` (Author):** String type. Relational 1-to-Many entity mapping (`Author -> Book`) to prevent data string duplication anomalies.
*   **`numero de paginas` (Total Pages):** Integer type. Strictly non-negative. Maps to `@map("numero_de_paginas")`.
*   **`nota personal` (Personal Rating):** Nullable Integer type. Supports an empty value cell state if a historical entry lacks a score review. Maps to `@map("nota_personal")`.
*   **`año` (Year):** Integer type. Indexed for high-speed chronological querying. Maps to `@map("ano")`.

---

## 4. Core Core Business Rules & Metrics Equations
The analytical engine must execute the following mathematical algorithms on the server side to power the visual dashboard:

### Chronological Metrics & Leap-Year Control
*   **Total Books:** Count of books marked as `COMPLETED` within a given year matching the `readingYear` index.
*   **Total Volumes Read:** Cumulative pages read across both completed books (`totalPages`) and currently active items (`currentPages`).
*   **Average Pages Per Book:** `StaticPagesInYear / TotalBooksInYear` (rounded to nearest integer).
*   **Average Pages Per Day:** Computed dynamically by evaluating the target calendar year. The system checks for leap years:
    \[\text{Days} = (\text{Year} \pmod 4 === 0 \land \text{Year} \pmod{100} !== 0) \lor (\text{Year} \pmod{400} === 0) ? 366 : 365\]
    The final daily speed average is calculated as: `NetPagesRead / Days`, fixed to 2 decimal points.

### Rankings & Recommender Engine Rules
*   **Top Authors & Genres:** Aggregated count queries limited to the top 5 records sorted by volume count in descending order.
*   **Discovery Suggestions:** An automated discovery algorithm that queries items in the `WISH_LIST` status filter whose relational `genreId` matches the user's top two most consumed categories historically.

---

## 5. Next Steps for Implementation
The project is divided into 5 phases (Setup, Migration, CRUD Development, Cloud Provisioning, Analytics Framework). The system is currently prepared to execute the **data ingestion layer components**.
