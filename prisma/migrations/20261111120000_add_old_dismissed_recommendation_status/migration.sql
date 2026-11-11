-- Add OLD_DISMISSED to RecommendationStatus enum for
-- "delete recommendation but keep it as an old dismissed recommendation".

-- AlterEnum
-- Warnings: The enum type 'RecommendationStatus' will be altered,
-- existing values may be dropped. Use "ALTER TYPE RecommendationStatus
-- ADD VALUE 'OLD_DISMISSED'" if you want to preserve existing values.
ALTER TYPE "RecommendationStatus" ADD VALUE 'OLD_DISMISSED';