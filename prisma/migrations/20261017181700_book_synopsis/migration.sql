ALTER TABLE `Book`
    ADD COLUMN `synopsis` TEXT NULL,
    ADD COLUMN `synopsis_language` VARCHAR(12) NULL,
    ADD COLUMN `synopsis_source_url` TEXT NULL,
    ADD COLUMN `synopsis_checked_at` DATETIME(3) NULL;
