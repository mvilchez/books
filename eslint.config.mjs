import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Encapsulation Validation (PLAN.md): the app layer must consume @/lib
  // services — only src/lib (services) and src/scripts (CLI tools) may talk
  // to the Prisma client. `scripts/check-encapsulation.sh` re-enforces the
  // same boundary as a plain grep for CI/pre-commit use.
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "Import domain services from @/lib/* instead of the raw Prisma client (PLAN.md — Encapsulation Validation).",
            },
            {
              name: "@prisma/client",
              message:
                "Import Prisma-backed types from @/lib services instead of @prisma/client (PLAN.md — Encapsulation Validation).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
