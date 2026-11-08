# Plan: Fix File Editing Complexity + Improve Main Page
## Problem
src/app/page.tsx is 533 lines with monolithic DashboardContent function handling data fetching, sorting, pagination, navigation, AND rendering. Editor tool fails due to complex pattern matching.
