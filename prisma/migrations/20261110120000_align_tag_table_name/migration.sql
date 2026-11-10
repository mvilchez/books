-- Align the physical table name with prisma/schema.prisma:
-- model `Tag` is declared with @@map("tags"), but the 0_init migration
-- created the table as `Tag`. Rename it to `tags` so the raw query in
-- getUsedTags() (src/lib/tags.ts) and Prisma Client queries resolve.
--
-- Idempotent: safe to re-apply on databases where the table is already
-- named `tags` (e.g. databases synced with `prisma db push`).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Tag'
  ) THEN
    EXECUTE 'ALTER TABLE "Tag" RENAME TO "tags"';
  END IF;
END $$;