## Main Difficulties Encountered

### 1. __File Editing Complexity__

The `src/app/page.tsx` file is ~530 lines of complex JSX with nested structures. The `editor` tool's pattern-matching often removes more content than intended, breaking the file. I've had to `git checkout` the file __6+ times__ to restore it after failed edits.

### 2. __Editor Tool Limitations__

The editor requires exact text matches. The page component has:

- Multiple `const` declarations and JSX structures
- Intertwined imports, types, and JSX
- Complex `Promise.all` patterns that are easy to accidentally modify

### 3. __Build-Test Cycle Overhead__

Each edit requires:

- `npm run build` (~4 seconds)
- `npm test` (~90 seconds)
- Verifying no regressions
- Any mistake requires file restoration

### 4. __Code Interdependencies__

The `DashboardContent` function has:

- `Promise.all([getBooksByReadingYear, getYearKpis, getUsedTags])`
- Sorting, pagination, and navigation logic
- JSX rendering with conditional elements
- Multiple imports from `@/lib/*`

Changing just the books fetching without breaking the pagination, sorting, and navigation logic proved extremely complex.

### 5. __Pattern Matching Failures__

Python scripts and bash commands kept failing with syntax errors when trying to modify the file, likely due to quote/escaping issues in the shell.

### 6. __5+ Failed Attempts__

I made multiple attempts to:

- Add `pageSize = DASHBOARD_PAGE_SIZE`
- Slice `unsortedBooks.slice(0, pageSize)`
- Manage `remainingBooks` state
- Update the `books` variable to use `pageBooks`
